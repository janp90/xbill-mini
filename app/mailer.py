import smtplib, ssl
from email.message import EmailMessage
from typing import Iterable, Tuple

Attachment = Tuple[str, bytes, str]  # (filename, data, mimetype)

def send_email_smtp(
    host: str, port: int, username: str, password: str,
    sender: str, recipient: str, subject: str, text: str,
    attachments: Iterable[Attachment] = (),
    use_starttls: bool = True
) -> None:
    msg = EmailMessage()
    msg["From"] = sender
    msg["To"] = recipient
    msg["Subject"] = subject
    msg.set_content(text)

    for filename, data, mimetype in attachments:
        maintype, subtype = mimetype.split("/", 1)
        msg.add_attachment(data, maintype=maintype, subtype=subtype, filename=filename)

    context = ssl.create_default_context()
    with smtplib.SMTP(host, port) as s:
        s.ehlo()
        if use_starttls:
            # Nur versuchen, wenn gewünscht – MailHog kann das nicht
            try:
                s.starttls(context=context)
                s.ehlo()
            except smtplib.SMTPException:
                pass
        if username or password:
            s.login(username, password)
        s.send_message(msg)

