from email.message import EmailMessage
import logging
import smtplib
import ssl

import httpx

from app.core.config import settings


class WebhookLogFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        message = record.getMessage()
        if "hooks.slack.com/services/" in message or "hooks.slack-gov.com/services/" in message:
            record.msg = "Slack webhook HTTP request (secret URL redacted)"
            record.args = ()
        return True


# httpx logs request URLs at INFO; an incoming webhook's path is a credential.
logging.getLogger("httpx").addFilter(WebhookLogFilter())


def delivery_configured() -> bool:
    if not settings.delivery_user_ids:
        return False
    if settings.delivery_channel == "slack":
        return bool(settings.slack_webhook_url.get_secret_value())
    if settings.delivery_channel == "email":
        return bool(settings.smtp_host and settings.smtp_from)
    return False


def send_report(channel: str, recipient: str, text: str):
    if channel == "slack":
        safe_text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        response = httpx.post(settings.slack_webhook_url.get_secret_value(), timeout=10, follow_redirects=False,
                              json={"text": safe_text, "mrkdwn": False, "link_names": False,
                                    "unfurl_links": False, "unfurl_media": False})
        response.raise_for_status()
    elif channel == "email":
        message = EmailMessage()
        message["Subject"] = "Your weekly AWS Cost Detective report"
        message["From"] = settings.smtp_from
        message["To"] = recipient
        message.set_content(text)
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
            if settings.smtp_starttls:
                smtp.starttls(context=ssl.create_default_context())
            if settings.smtp_username:
                if not settings.smtp_starttls:
                    raise ValueError("SMTP credentials require STARTTLS")
                smtp.login(settings.smtp_username, settings.smtp_password.get_secret_value())
            smtp.send_message(message)
    else:
        raise ValueError("Unknown delivery channel")
