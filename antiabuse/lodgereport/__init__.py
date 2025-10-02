from database import api_tx
from antiabuse.sql import (
    Q_LAST_MESSAGES,
    Q_MAKE_REPORT,
    Q_INSERT_SKIPPED,
)
from typing import Any
import os
from smtp import aws_smtp
import traceback
import threading
import html
import yaml
import erlastic
from io import StringIO
import re
from dataclasses import dataclass
import random


@dataclass(frozen=True)
class EmailEntry:
    email: str
    count: int


def _decode_last_messages_in_place(last_messages: list[dict]):
    for message in last_messages:
        try:
            search_body = message['search_body']
        except:
            search_body = None

        m = erlastic.decode(message['message'])

        try:
            m = m[3][0][3][0][1].decode('utf-8')
        except:
            m = dict(
                error=(
                    "Couldn't unpack message while generating report. "
                    "Falling back to message search body"),
                search_body=search_body,
            )

        message['message'] = m


def _repack_last_messages_in_place(last_messages: list[dict]):
    for i in range(len(last_messages)):
        m = last_messages[i]

        last_messages[i] = { m['sent_by']: m['message'] }


def _obj_to_yaml_string(obj):
    class IndentDumper(yaml.Dumper):
        def increase_indent(self, flow=False, indentless=False):
            return super(IndentDumper, self).increase_indent(flow, False)

    output = StringIO()
    yaml.dump(obj, output, indent=2, allow_unicode=True, Dumper=IndentDumper)
    return output.getvalue()


def _photo_links_to_html(photo_links):
    def link_to_html(photo_link):
        return f'''
            <img src="{photo_link}" style="max-width: 200px;
            max-height: 200px; width: auto; height: auto;
            border: 1px solid black;">
            '''

    return ''.join(
        link_to_html(l) + ('<br>' if ((i + 1) % 3 == 0 and i > 0) else '')
        for i, l in enumerate(photo_links)
    )


def report_template(
    report_obj,
    reason: str,
    last_messages: list[dict],
):
    reporter_token = report_obj[0]['token']
    accused_token = report_obj[1]['token']

    accused_photo_links = report_obj[1]['photo_links']

    object_person_id = report_obj[1]['id']

    _decode_last_messages_in_place(last_messages)
    _repack_last_messages_in_place(last_messages)

    report_str = _obj_to_yaml_string(report_obj)
    last_messages_str = _obj_to_yaml_string(last_messages)

    safe_report_str = html.escape(report_str)
    safe_reason = html.escape(reason)
    safe_last_messages = html.escape(last_messages_str)

    accused_img_html = _photo_links_to_html(accused_photo_links)

    return f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Report</title>
</head>
<body>

<pre>
{safe_report_str}
</pre>


<p><b>Accused person's images:</b></p>
{accused_img_html}


<p><b>Last messages between reporter and accused:</b></p>
<pre>
{safe_last_messages}
</pre>


<p><b>Reporter's reason:</b></p>
<pre>
{safe_reason}
</pre>


<p><b>Ban REPORTING user for one month:</b></p>
<a href="https://api.duolicious.app/admin/ban-link/{reporter_token}">
         https://api.duolicious.app/admin/ban-link/{reporter_token}
</a>

<br/>
<br/>

<p><b>Ban ACCUSED user for one month:</b></p>
<a href="https://api.duolicious.app/admin/ban-link/{accused_token}">
         https://api.duolicious.app/admin/ban-link/{accused_token}
</a>

</body>
</html>
"""


def parse_email_string(email_string):
    # Regular expression to match an email followed optionally by a number
    pattern = r'(\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b)(?:\s+(\d+))?'
    matches = re.findall(pattern, email_string)

    result = []
    for email, count in matches:
        # If no number is given, default to 1
        if count == '':
            count = 1
        else:
            count = int(count)
        result.append(EmailEntry(email, count))

    return result


REPORT_EMAIL = os.environ['DUO_REPORT_EMAIL']
REPORT_EMAILS = parse_email_string(REPORT_EMAIL)
PRIMARY_REPORT_EMAIL = REPORT_EMAILS[0].email
print(REPORT_EMAILS)


def _sample_email_addresses(email_entries):
    # Extract the emails and their respective weights from the list of EmailEntry instances
    emails = [entry.email for entry in email_entries]
    weights = [entry.count for entry in email_entries]

    # Use random.choices() to perform weighted sampling and return a single email
    sampled_email = random.choices(emails, weights=weights, k=1)[0]  # Get the first item from the result

    return sampled_email


def _send_report_email(
    reason: str,
    report_obj: Any,
    last_messages: list[dict],
    is_automoded_bot: bool,
):
    subject_person_id = report_obj[0]['id']
    object_person_id  = report_obj[1]['id']

    report_email = _sample_email_addresses(REPORT_EMAILS)

    subject = f"Report: {subject_person_id} - {object_person_id}"
    subject += ' [automoded]' if is_automoded_bot else ''

    try:
        aws_smtp.send(
            subject=subject,
            body=report_template(
                report_obj=report_obj,
                reason=reason,
                last_messages=last_messages,
            ),
            to_addr=report_email,
            from_addr=PRIMARY_REPORT_EMAIL,
        )
    except:
        print(traceback.format_exc())


def lodge_report(
    subject_uuid: str,
    object_uuid: str,
    reason: str,
    is_automoded_bot: bool
):
    params = dict(
        subject_uuid=subject_uuid,
        object_uuid=object_uuid,
        reason=reason,
    )

    with api_tx() as tx:
        last_messages = tx.execute(Q_LAST_MESSAGES, params=params).fetchall()

        report_obj = tx.execute(Q_MAKE_REPORT, params=params).fetchall()

    threading.Thread(
        target=_send_report_email,
        kwargs=dict(
            report_obj=report_obj,
            reason=reason,
            last_messages=last_messages,
            is_automoded_bot=is_automoded_bot,
        )
    ).start()


def is_bot_report(reason: str):
    detection_pattern = re.compile(
        r'\b(fake|(cat\s*fish(ing)?)|scam|scammer|bot)\b',
        re.I
    )

    cleaning_pattern = re.compile('[^0-9a-zA-Z]+')

    clean_reason = ' '.join(cleaning_pattern.sub(' ', reason).split())

    return bool(re.search(detection_pattern, clean_reason))


def skip_by_uuid(subject_uuid: str, object_uuid: str, reason: str):
    params = dict(
        subject_uuid=subject_uuid,
        object_uuid=object_uuid,
        reported=bool(reason),
        report_reason=reason or '',
        is_bot_report=is_bot_report(reason),
    )

    with api_tx() as tx:
        tx.execute(Q_INSERT_SKIPPED, params=params)
        row = tx.fetchone()

    if reason:
        lodge_report(
            subject_uuid=subject_uuid,
            object_uuid=object_uuid,
            reason=reason,
            is_automoded_bot=row['is_automoded_bot'],
        )
