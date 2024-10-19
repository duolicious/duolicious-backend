import traceback
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import os
import time

SMTP_HOST = os.environ['DUO_SMTP_HOST']
SMTP_PORT = os.environ['DUO_SMTP_PORT']
SMTP_USER = os.environ['DUO_SMTP_USER']
SMTP_PASS = os.environ['DUO_SMTP_PASS']

class Smtp:
    def __init__(self, host: str, port: int, username: str, password: str):
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.smtp = None

        self._connect()

    def _connect(self):
        try:
            print(f'Establishing connection to SMTP server at {self.host}')
            self.smtp = smtplib.SMTP(self.host, self.port)
            self.smtp.starttls()
            self.smtp.login(self.username, self.password)
            print(f'Connection to SMTP server at {self.host} established')
        except Exception as e:
            print(f'Failed to connect to SMTP server: {e}')

    def _reconnect(self):
        if self.smtp:
            try:
                self.smtp.quit()
            except Exception as e:
                print(f'Error while quitting SMTP connection: {e}')
        self._connect()

    def __del__(self):
        if self.smtp:
            try:
                self.smtp.quit()
            except Exception as e:
                print(f'Error while quitting SMTP connection: {e}')

    def _try_send(
        self,
        subject: str,
        body: str,
        to_addr: str,
        from_addr: str | None = None,
    ):
        _from_addr = from_addr or 'no-reply@duolicious.app'

        msg = MIMEMultipart('alternative')
        msg['From'] = f'Duolicious <{_from_addr}>'
        msg['To'] = to_addr
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'html'))

        self.smtp.sendmail(
            from_addr=_from_addr,
            to_addrs=to_addr,
            msg=msg.as_string(),
        )

    def send(
            self,
            subject: str,
            body: str,
            to_addr: str,
            from_addr: str | None = None):
        try:
            self._try_send(
                    subject=subject,
                    body=body,
                    to_addr=to_addr,
                    from_addr=from_addr)
        except:
            print(traceback.format_exc())
            print('First attempt to send mail failed. Trying again.')
            try:
                self._connect()
                self._try_send(
                        subject=subject,
                        body=body,
                        to_addr=to_addr,
                        from_addr=from_addr)
            except:
                print(traceback.format_exc())
                print('Second attempt to send mail failed. Giving up.')

def make_aws_smtp():
    return Smtp(SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS)

aws_smtp = make_aws_smtp();
