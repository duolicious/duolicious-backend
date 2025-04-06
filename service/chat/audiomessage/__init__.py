from duoaudio import transcode_and_trim_audio_from_base64
from service.chat.message import AudioMessage
import secrets

Q_INSERT_AUDIO = """
"""


def save_audio_bytes(audio_bytes: bytes) -> str | None:
    uuid = secrets.token_hex(32)
    return None


def save_audio_base64(audio_base64: str) -> str | None:
    response = transcode_and_trim_audio_from_base64(audio_base64=audio_base64)

    if isinstance(response, ValueError):
        return None
    else:
        _, transcoded = response

        return save_audio_bytes(transcoded)

def process_audio_message(message: AudioMessage) -> list[str]:
    stanza_id = message.stanza_id

    uuid = save_audio_base64(audio_base64=message.audio_base64)

    if uuid:
        return [f'<duo_message_delivered id="{stanza_id}" audio_uuid="{uuid}" />']
    else:
        return [f'<duo_server_error id="{stanza_id}" />']
