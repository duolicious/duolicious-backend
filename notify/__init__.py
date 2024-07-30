import json
import traceback
import urllib.request

def send_mobile_notification(
    token: str | None,
    title: str,
    body: str
):
    if not token:
        raise ValueError('Token not present')

    message = dict(
        to=token,
        sound='default',
        title=title,
        body=body,
        priority='high',
    )

    headers = {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
    }

    req = urllib.request.Request(
        url='https://exp.host/--/api/v2/push/send?useFcmV1=true',
        data=json.dumps(message).encode('utf-8'),
        headers=headers,
        method='POST'
    )

    with urllib.request.urlopen(req) as response:
        response_data = response.read().decode('utf-8')

    try:
        parsed_data = json.loads(response_data)
        assert parsed_data["data"]["status"] == "ok"
        return True
    except:
        print(traceback.format_exc())

    return False
