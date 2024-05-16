import html
import yaml
from io import StringIO

def obj_to_yaml_string(obj):
    class IndentDumper(yaml.Dumper):
        def increase_indent(self, flow=False, indentless=False):
            return super(IndentDumper, self).increase_indent(flow, False)

    output = StringIO()
    yaml.dump(obj, output, indent=2, allow_unicode=True, Dumper=IndentDumper)
    return output.getvalue()

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

def report_template(
    report_obj,
    report_reason: str,
    last_messages: [str]
):
    reporter_token = report_obj[0]['token']
    accused_token = report_obj[1]['token']

    object_person_id = report_obj[1]['id']

    report_str = obj_to_yaml_string(report_obj)
    last_messages_str = obj_to_yaml_string(last_messages)

    safe_report_str = html.escape(report_str)
    safe_report_reason = html.escape(report_reason)
    safe_last_messages = html.escape(last_messages_str)

    return f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Report</title>
</head>
<body>

<p><b>
From Duodaddy: There's a new report format largely because the previous one had
a vulnerability which was being exploited. Bad guys were able to post fake chat
logs. If you see *conversations* in this report, they should be treated with
scepticism. Although the new report includes the accused person's last few
messages, which are certain to be what the accused person sent.
</b></p>

<p><b>
You're also now able to ban reporters for abusing the reporting system
</b></p>

<pre>
{safe_report_str}
</pre>

<p><b>Reporter's reason:</b></p>

<pre>
{safe_report_reason}
</pre>

<p><b>Accused person's last messages:</b></p>

<pre>
{safe_last_messages}
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

