package mercadopago

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/nuestra-medicina-personal/backend/internal/domain/order"
)

const defaultAPIURL = "https://api.mercadopago.com"

type Client struct {
	httpClient    *http.Client
	apiURL        string
	accessToken   string
	publicBaseURL string
}

// NewClient talks to the real Mercado Pago API unless apiURL overrides it —
// used only to point at a fake server in E2E tests (see e2e/README.md);
// production always passes "" here.
func NewClient(accessToken, publicBaseURL, apiURL string) *Client {
	if apiURL == "" {
		apiURL = defaultAPIURL
	}
	return &Client{
		httpClient: &http.Client{Timeout: 10 * time.Second}, apiURL: apiURL,
		accessToken: accessToken, publicBaseURL: strings.TrimRight(publicBaseURL, "/"),
	}
}

func (c *Client) Configured() bool { return c.accessToken != "" && c.publicBaseURL != "" }

func (c *Client) CreatePreference(ctx context.Context, input order.PreferenceRequest) (order.Preference, error) {
	checkoutPath := "/checkout/" + url.PathEscape(input.BookSlug)
	payload := preferencePayload{
		Items: []preferenceItem{{
			ID: input.BookID, Title: input.Title, Description: input.Description,
			CurrencyID: input.Currency, Quantity: 1, UnitPrice: decimalAmount(input.AmountMinorUnits),
		}},
		Payer: payer{Email: input.PayerEmail},
		BackURLs: backURLs{
			Success: c.publicBaseURL + checkoutPath + "?status=approved",
			Pending: c.publicBaseURL + checkoutPath + "?status=pending",
			Failure: c.publicBaseURL + checkoutPath + "?status=failed",
		},
		AutoReturn:        "approved",
		ExternalReference: input.OrderID,
		NotificationURL:   c.publicBaseURL + "/api/v1/webhooks/mercadopago?source_news=webhooks",
	}
	var response struct {
		ID               string `json:"id"`
		InitPoint        string `json:"init_point"`
		SandboxInitPoint string `json:"sandbox_init_point"`
	}
	if err := c.doJSON(ctx, http.MethodPost, "/checkout/preferences", input.OrderID, payload, &response); err != nil {
		return order.Preference{}, err
	}
	checkoutURL := response.InitPoint
	if checkoutURL == "" {
		checkoutURL = response.SandboxInitPoint
	}
	if response.ID == "" || checkoutURL == "" {
		return order.Preference{}, errors.New("mercado pago preference response is incomplete")
	}
	return order.Preference{ID: response.ID, CheckoutURL: checkoutURL}, nil
}

func (c *Client) GetPayment(ctx context.Context, paymentID string) (order.ProviderPayment, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, c.apiURL+"/v1/payments/"+url.PathEscape(paymentID), nil)
	if err != nil {
		return order.ProviderPayment{}, fmt.Errorf("create payment request: %w", err)
	}
	request.Header.Set("Authorization", "Bearer "+c.accessToken)
	response, err := c.httpClient.Do(request)
	if err != nil {
		return order.ProviderPayment{}, fmt.Errorf("request payment: %w", err)
	}
	defer response.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(response.Body, 1<<20))
	if err != nil {
		return order.ProviderPayment{}, fmt.Errorf("read payment response: %w", err)
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return order.ProviderPayment{}, fmt.Errorf("mercado pago payment returned status %d", response.StatusCode)
	}
	var payload struct {
		ID                json.Number `json:"id"`
		Status            string      `json:"status"`
		ExternalReference string      `json:"external_reference"`
		TransactionAmount json.Number `json:"transaction_amount"`
		CurrencyID        string      `json:"currency_id"`
	}
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.UseNumber()
	if err := decoder.Decode(&payload); err != nil {
		return order.ProviderPayment{}, fmt.Errorf("decode payment response: %w", err)
	}
	amount, err := minorUnitsFromDecimal(payload.TransactionAmount)
	if err != nil {
		return order.ProviderPayment{}, fmt.Errorf("decode payment amount: %w", err)
	}
	return order.ProviderPayment{
		ProviderPaymentID: payload.ID.String(), ExternalReference: payload.ExternalReference,
		Status: mapPaymentStatus(payload.Status), RawStatus: payload.Status,
		AmountMinorUnits: amount, Currency: payload.CurrencyID, RawPayload: raw,
	}, nil
}

func (c *Client) doJSON(ctx context.Context, method, path, idempotencyKey string, input, output any) error {
	encoded, err := json.Marshal(input)
	if err != nil {
		return fmt.Errorf("encode mercado pago request: %w", err)
	}
	request, err := http.NewRequestWithContext(ctx, method, c.apiURL+path, bytes.NewReader(encoded))
	if err != nil {
		return fmt.Errorf("create mercado pago request: %w", err)
	}
	request.Header.Set("Authorization", "Bearer "+c.accessToken)
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("X-Idempotency-Key", idempotencyKey)
	response, err := c.httpClient.Do(request)
	if err != nil {
		return fmt.Errorf("request mercado pago: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		_, _ = io.Copy(io.Discard, io.LimitReader(response.Body, 1<<20))
		return fmt.Errorf("mercado pago returned status %d", response.StatusCode)
	}
	if err := json.NewDecoder(io.LimitReader(response.Body, 1<<20)).Decode(output); err != nil {
		return fmt.Errorf("decode mercado pago response: %w", err)
	}
	return nil
}

type preferencePayload struct {
	Items             []preferenceItem `json:"items"`
	Payer             payer            `json:"payer"`
	BackURLs          backURLs         `json:"back_urls"`
	AutoReturn        string           `json:"auto_return"`
	ExternalReference string           `json:"external_reference"`
	NotificationURL   string           `json:"notification_url"`
}

type preferenceItem struct {
	ID          string        `json:"id"`
	Title       string        `json:"title"`
	Description string        `json:"description,omitempty"`
	CurrencyID  string        `json:"currency_id"`
	Quantity    int           `json:"quantity"`
	UnitPrice   decimalAmount `json:"unit_price"`
}

type payer struct {
	Email string `json:"email"`
}

type backURLs struct {
	Success string `json:"success"`
	Pending string `json:"pending"`
	Failure string `json:"failure"`
}

type decimalAmount int64

func (amount decimalAmount) MarshalJSON() ([]byte, error) {
	minor := int64(amount)
	if minor < 0 {
		return nil, errors.New("amount cannot be negative")
	}
	return []byte(fmt.Sprintf("%d.%02d", minor/100, minor%100)), nil
}

func minorUnitsFromDecimal(value json.Number) (int64, error) {
	rational, ok := new(big.Rat).SetString(value.String())
	if !ok {
		return 0, errors.New("invalid decimal amount")
	}
	rational.Mul(rational, big.NewRat(100, 1))
	if !rational.IsInt() {
		return 0, errors.New("amount has more than two decimal places")
	}
	if !rational.Num().IsInt64() {
		return 0, errors.New("amount is outside int64 range")
	}
	return rational.Num().Int64(), nil
}

func mapPaymentStatus(status string) order.PaymentStatus {
	switch strings.ToLower(status) {
	case "approved":
		return order.PaymentApproved
	case "rejected":
		return order.PaymentRejected
	case "cancelled":
		return order.PaymentCancelled
	case "refunded", "charged_back":
		return order.PaymentRefunded
	default:
		return order.PaymentPending
	}
}
