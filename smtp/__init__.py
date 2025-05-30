"""Thread‑safe SMTP helper with typed API and automatic retries.
"""

import os
import smtplib
import threading
import time
import traceback
from contextlib import suppress
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

SMTP_HOST: str = os.environ["DUO_SMTP_HOST"]
SMTP_PORT: int = int(os.environ["DUO_SMTP_PORT"])
SMTP_USER: str = os.environ["DUO_SMTP_USER"]
SMTP_PASS: str = os.environ["DUO_SMTP_PASS"]


class Smtp:
    def __init__(
        self,
        host: str,
        port: int,
        username: str,
        password: str,
    ) -> None:
        self.host: str = host
        self.port: int = port
        self.username: str = username
        self.password: str = password
        self._smtp: smtplib.SMTP | None = None

        self._lock: threading.RLock = threading.RLock()

        self._connect()

    def _connect(self) -> None:
        """(Re)‑establish an SMTP connection (protected by *lock*)."""
        with self._lock:
            if self._smtp is not None:
                try:
                    self._smtp.noop()
                    return  # connection still healthy
                except smtplib.SMTPServerDisconnected:
                    self._smtp = None

            try:
                print(f"Establishing connection to SMTP server at {self.host}")
                smtp = smtplib.SMTP(self.host, self.port, timeout=30)
                smtp.ehlo()

                if smtp.has_extn("starttls"):
                    smtp.starttls()
                    smtp.ehlo()  # re-identify as TLS is now in effect
                    print("STARTTLS supported and initiated.")
                else:
                    print("STARTTLS not supported by server.")

                smtp.login(self.username, self.password)
                self._smtp = smtp
                print(f"Connection to SMTP server at {self.host} established")
            except Exception as exc:
                print(f"Failed to connect to SMTP server: {exc}")
                self._smtp = None
                raise

    def _try_send(
        self,
        *,
        subject: str,
        body: str,
        to_addr: str,
        from_addr: str | None = None,
    ) -> None:
        if self._smtp is None:
            # Lazily reconnect if previous attempt failed.
            self._connect()

        if self._smtp is None:
            raise Exception("Connection couldn't be established")

        _from_addr: str = from_addr or "no-reply@duolicious.app"

        msg = MIMEMultipart("alternative")
        msg["From"] = f"Duolicious <{_from_addr}>"
        msg["To"] = to_addr
        msg["Subject"] = subject
        msg.attach(MIMEText(body, "html"))

        self._smtp.sendmail(
            from_addr=_from_addr,
            to_addrs=[to_addr],
            msg=msg.as_string(),
        )

    def send(
        self,
        *,
        subject: str,
        body: str,
        to_addr: str,
        from_addr: str | None = None,
        retries: int | None = None,
        backoff: int | None = None,
    ) -> None:
        """Send an email, retrying on failure.

        Back‑off doubles on every failed attempt: *backoff* × 2^(n - 1).
        """
        max_attempts: int = 1 + (2 if retries is None else retries)

        for attempt in range(1, max_attempts + 1):
            try:
                with self._lock:
                    self._try_send(
                        subject=subject,
                        body=body,
                        to_addr=to_addr,
                        from_addr=from_addr,
                    )
                return  # Success
            except Exception:
                print(traceback.format_exc())
                if attempt == max_attempts:
                    print("All retry attempts exhausted. Giving up.")

                delay_base: float = 1.0 if backoff is None else backoff
                delay = delay_base * (2 ** (attempt - 1))
                print(f"Attempt {attempt} failed; retrying in {delay:.1f}s.")
                time.sleep(delay)

                # Best effort reconnect for the next iteration
                with suppress(Exception):
                    self._connect()

    # ------------------------------------------------------------------

    def quit(self) -> None:
        """Explicitly close the SMTP connection."""
        with self._lock:
            if self._smtp is not None:
                try:
                    self._smtp.quit()
                except Exception as exc:
                    print(f"Error while quitting SMTP connection: {exc}")
                finally:
                    self._smtp = None

    def __del__(self) -> None:
        with suppress(Exception):  # _smtp may already be closed
            self.quit()


def make_aws_smtp() -> Smtp:
    return Smtp(SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS)


aws_smtp: Smtp = make_aws_smtp()
