package gmail

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime"
	"mime/multipart"
	"mime/quotedprintable"
	"net/http"
	"net/mail"
	"os"
	"strings"

	"golang.org/x/oauth2/google"

	emaildomain "github.com/nuestra-medicina-personal/backend/internal/domain/email"
)

const gmailSendScope = "https://www.googleapis.com/auth/gmail.send"

type Client struct {
	sender  string
	client  *http.Client
	baseURL string
}

func NewClient(credentialsPath, sender string) (*Client, error) {
	if credentialsPath == "" && sender == "" {
		return &Client{}, nil
	}
	if credentialsPath == "" || sender == "" {
		return nil, errors.New("Gmail credentials path and sender must be configured together")
	}
	if _, err := mail.ParseAddress(sender); err != nil {
		return nil, fmt.Errorf("parse Gmail sender: %w", err)
	}
	credentials, err := os.ReadFile(credentialsPath)
	if err != nil {
		return nil, fmt.Errorf("read Gmail service account credentials: %w", err)
	}
	configuration, err := google.JWTConfigFromJSON(credentials, gmailSendScope)
	if err != nil {
		return nil, fmt.Errorf("parse Gmail service account credentials: %w", err)
	}
	configuration.Subject = sender
	return &Client{
		sender: sender, client: configuration.Client(context.Background()),
		baseURL: "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
	}, nil
}

func (c *Client) Configured() bool { return c.client != nil && c.sender != "" }

func (c *Client) Send(ctx context.Context, message emaildomain.Message) (string, error) {
	if !c.Configured() {
		return "", errors.New("Gmail API is not configured")
	}
	raw, err := buildMIME(c.sender, message)
	if err != nil {
		return "", err
	}
	payload, err := json.Marshal(map[string]string{"raw": base64.RawURLEncoding.EncodeToString(raw)})
	if err != nil {
		return "", fmt.Errorf("encode Gmail request: %w", err)
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL, bytes.NewReader(payload))
	if err != nil {
		return "", fmt.Errorf("create Gmail request: %w", err)
	}
	request.Header.Set("Content-Type", "application/json")
	response, err := c.client.Do(request)
	if err != nil {
		return "", fmt.Errorf("send Gmail request: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(response.Body, 4096))
		return "", fmt.Errorf("Gmail API returned %d: %s", response.StatusCode, strings.TrimSpace(string(body)))
	}
	var result struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(io.LimitReader(response.Body, 1<<20)).Decode(&result); err != nil {
		return "", fmt.Errorf("decode Gmail response: %w", err)
	}
	if result.ID == "" {
		return "", errors.New("Gmail API response did not include a message id")
	}
	return result.ID, nil
}

func buildMIME(sender string, message emaildomain.Message) ([]byte, error) {
	from, err := mail.ParseAddress(sender)
	if err != nil {
		return nil, fmt.Errorf("parse sender: %w", err)
	}
	to, err := mail.ParseAddress(message.To)
	if err != nil {
		return nil, fmt.Errorf("parse recipient: %w", err)
	}
	if strings.ContainsAny(message.Subject, "\r\n") {
		return nil, errors.New("email subject contains a newline")
	}
	var body bytes.Buffer
	boundary := multipart.NewWriter(&body)
	writeHeader := func(name, value string) { _, _ = fmt.Fprintf(&body, "%s: %s\r\n", name, value) }
	writeHeader("From", from.String())
	writeHeader("To", to.String())
	writeHeader("Subject", mime.QEncoding.Encode("UTF-8", message.Subject))
	writeHeader("MIME-Version", "1.0")
	writeHeader("Content-Type", `multipart/alternative; boundary="`+boundary.Boundary()+`"`)
	_, _ = body.WriteString("\r\n")
	if err := writePart(boundary, "text/plain; charset=UTF-8", message.TextBody); err != nil {
		return nil, err
	}
	if err := writePart(boundary, "text/html; charset=UTF-8", message.HTMLBody); err != nil {
		return nil, err
	}
	if err := boundary.Close(); err != nil {
		return nil, fmt.Errorf("close MIME message: %w", err)
	}
	return body.Bytes(), nil
}

func writePart(writer *multipart.Writer, contentType, content string) error {
	header := make(map[string][]string)
	header["Content-Type"] = []string{contentType}
	header["Content-Transfer-Encoding"] = []string{"quoted-printable"}
	part, err := writer.CreatePart(header)
	if err != nil {
		return fmt.Errorf("create MIME part: %w", err)
	}
	encoded := quotedprintable.NewWriter(part)
	if _, err := encoded.Write([]byte(content)); err != nil {
		return fmt.Errorf("write MIME part: %w", err)
	}
	if err := encoded.Close(); err != nil {
		return fmt.Errorf("close MIME part: %w", err)
	}
	return nil
}
