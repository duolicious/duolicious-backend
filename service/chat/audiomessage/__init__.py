from duoaudio import (
    put_audio_in_object_store,
    transcode_and_trim_audio_from_base64,
)
from service.chat.message import AudioMessage
import secrets

def transcode_and_put(
    uuid: str,
    audio_base64: str
) -> bool:
    response = transcode_and_trim_audio_from_base64(audio_base64=audio_base64)

    if isinstance(response, ValueError):
        # TODO: Handle the error case
        return False

    _, transcoded = response

    put_audio_in_object_store(uuid=uuid, audio_file_bytes=transcoded)

    return True
