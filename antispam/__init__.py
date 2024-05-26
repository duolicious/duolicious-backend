from antispam.sql import *
from database import api_tx
import json
import os
import urllib.parse
import urllib.request
from pathlib import Path

DUO_VERIFY_MAIL_API_KEY = os.environ['DUO_VERIFY_MAIL_API_KEY']

is_disposable_email_file = (
    Path(__file__).parent.parent /
    'test' /
    'input' /
    'is-disposable-email')

dot_insignificant_email_domains = set([
    "gmail.com",
    "googlemail.com",
])

plus_address_domains = set([
    "fastmail.com",
    "fastmail.fm",
    "gmail.com",
    "googlemail.com",
    "live.com",
    "outlook.com",
    "pm.me",
    "proton.me",
    "protonmail.com",
    "zoho.com",
    "zohomail.com",
])

def is_disposable_email(email):
    if is_disposable_email_file.is_file():
        with is_disposable_email_file.open() as file:
            flag = file.read().strip()
            if flag == '1': return True
            if flag == '0': return False

    query = urllib.parse.quote(email)
    url = f"https://verifymail.io/api/{query}?key={DUO_VERIFY_MAIL_API_KEY}"

    try:
        with urllib.request.urlopen(url) as response:
            data = response.read().decode('utf-8')
            json_data = json.loads(data)
            return json_data.get("disposable", False)
    except Exception as e:
        print(f"An error occurred: {e}")
        return None
    return False

def check_and_update_bad_domains(email):
    _, domain = email.split('@')

    params = dict(email=email, domain=domain)

    # Check if we already know about the email domain
    with api_tx() as tx:
        domain_status = tx.execute(
            Q_EMAIL_INFO,
            params=params
        ).fetchone()['domain_status']

    if domain_status == 'registered':
        return True
    elif domain_status == 'unregistered-good':
        return True
    elif domain_status == 'unregistered-bad':
        return False
    elif domain_status == 'unregistered-unknown':
        pass
    else:
        raise Exception('Unhandled domain status')

    # Query the API and update the DB if we don't know about the domain
    is_disposable_email_ = is_disposable_email(email)

    if is_disposable_email_ is True:
        with api_tx() as tx:
            tx.execute(Q_INSERT_BAD_DOMAIN, params=params)
        return False
    elif is_disposable_email_ is False:
        with api_tx() as tx:
            tx.execute(Q_INSERT_GOOD_DOMAIN, params=params)
        return True
    elif is_disposable_email_ is None:
        return True
    else:
        raise Exception('Unhandled API response')

def normalize_email_dots(email: str) -> str:
    name, domain = email.lower().split('@')

    if domain not in dot_insignificant_email_domains:
        return email

    name = name.replace('.', '')

    return f'{name}@{domain}'

def normalize_email_pluses(email: str) -> str:
    name, domain = email.lower().split('@')

    if domain not in plus_address_domains:
        return email

    name, *_ = name.split('+')

    return f'{name}@{domain}'

def normalize_email(email: str) -> str:
    return normalize_email_dots(normalize_email_pluses(email))
