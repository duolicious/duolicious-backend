import html
import yaml
from io import StringIO
import erlastic

def obj_to_yaml_string(obj):
    class IndentDumper(yaml.Dumper):
        def increase_indent(self, flow=False, indentless=False):
            return super(IndentDumper, self).increase_indent(flow, False)

    output = StringIO()
    yaml.dump(obj, output, indent=2, allow_unicode=True, Dumper=IndentDumper)
    return output.getvalue()

def photo_links_to_html(photo_links):
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

def otp_template(otp: str):
    return f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sign in to Duolicious</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif;">
    <table width="100%" cellspacing="0" cellpadding="0" border="0" align="center">
        <tr>
            <td align="center">
                <table style="max-width: 600px; width: 100%;" cellspacing="0" cellpadding="0" border="0" align="center">
                    <tr>
                        <td bgcolor="#70f" align="center">
                            <img src="https://email-assets.duolicious.app/header-logo.png" alt="Duolicious Logo" width="108" height="50" />
                        </td>
                    </tr>
                    <tr>
                        <td bgcolor="#f1e5ff" height="20">&nbsp;</td>
                    </tr>
                    <tr>
                        <td bgcolor="#f1e5ff" align="center" style="color: #70f;">
                            <p style="color: #70f; font-size: 16px">Your one-time password is:</p>
                            <table cellspacing="0" cellpadding="0" border="0" align="center">
                                <tr>
                                    <td bgcolor="#70f" style="font-weight: 900; font-size: 32px; color: white; padding: 15px; border-radius: 15px;">{otp}</td>
                                </tr>
                            </table>
                            <p style="color: #70f; font-size: 16px">If you didn’t request this, you can ignore this message.</p>
                        </td>
                    </tr>
                    <tr>
                        <td bgcolor="#f1e5ff" height="20">&nbsp;</td>
                    </tr>
                    <tr>
                        <td bgcolor="#70f" height="50">&nbsp;</td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
"""

def decode_last_messages_in_place(last_messages: list[dict]):
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

def repack_last_messages_in_place(last_messages: list[dict]):
    for i in range(len(last_messages)):
        m = last_messages[i]

        last_messages[i] = { m['sent_by']: m['message'] }

def report_template(
    report_obj,
    report_reason: str,
    last_messages: list[dict]
):
    reporter_token = report_obj[0]['token']
    accused_token = report_obj[1]['token']

    accused_photo_links = report_obj[1]['photo_links']

    object_person_id = report_obj[1]['id']

    decode_last_messages_in_place(last_messages)
    repack_last_messages_in_place(last_messages)

    report_str = obj_to_yaml_string(report_obj)
    last_messages_str = obj_to_yaml_string(last_messages)

    safe_report_str = html.escape(report_str)
    safe_report_reason = html.escape(report_reason)
    safe_last_messages = html.escape(last_messages_str)

    accused_img_html = photo_links_to_html(accused_photo_links)

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
{safe_report_reason}
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

