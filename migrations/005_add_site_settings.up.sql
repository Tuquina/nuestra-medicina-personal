CREATE TABLE site_settings (
    singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
    site_name VARCHAR(200) NOT NULL,
    site_description VARCHAR(500) NOT NULL DEFAULT '',
    support_email VARCHAR(320) NOT NULL,
    newsletter_email VARCHAR(320) NOT NULL,
    sender_name VARCHAR(200) NOT NULL,
    seo_title VARCHAR(200) NOT NULL DEFAULT '',
    seo_description VARCHAR(500) NOT NULL DEFAULT '',
    seo_indexable BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO site_settings (
    singleton, site_name, site_description, support_email, newsletter_email,
    sender_name, seo_title, seo_description, seo_indexable
) VALUES (
    TRUE,
    'Nuestra Medicina Personal',
    'Escritura, reflexión y herramientas para procesos personales y educativos.',
    'soporte@nuestramedicinapersonal.com',
    'novedades@nuestramedicinapersonal.com',
    'Nuestra Medicina Personal',
    'Nuestra Medicina Personal — Escritura y reflexión',
    'Libros y herramientas de escritura y reflexión personal.',
    TRUE
);
