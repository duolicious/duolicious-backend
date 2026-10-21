from pathlib import Path
import re

import numpy as np
import onnxruntime as ort
from tokenizers import Tokenizer

from serviceshared.antiabuse.normalize import normalize_chat_message
from serviceshared.duoenv.shared import OMP_NUM_THREADS

_DIR = Path(__file__).parent

_ALWAYS_RUDE = re.compile(
    r"\b(1488|cunny|heil hitler|kikes?|lolicon|shotacon|sieg heil|trannoids?|"
    r"you(?: wi|['’])ll never be a (?:real )?woman|ywnbar?w)\b|(?<!s)nigger",
    re.IGNORECASE)

_TOKENIZER = Tokenizer.from_file(str(_DIR / 'tokenizer.json'))

_SESSION_OPTIONS = ort.SessionOptions()
_SESSION_OPTIONS.intra_op_num_threads = OMP_NUM_THREADS
_SESSION_OPTIONS.inter_op_num_threads = 1
_SESSION_OPTIONS.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
_SESSION_OPTIONS.add_session_config_entry(
    'session.intra_op.allow_spinning', '0')

_SESSION = ort.InferenceSession(str(_DIR / 'model.onnx'), _SESSION_OPTIONS)


def is_rude(s: str) -> bool:
    text = normalize_chat_message(s)

    if _ALWAYS_RUDE.search(text):
        return True

    encoding = _TOKENIZER.encode(text)

    return any(
        _SESSION.run(None, {'input_ids': np.array([window.ids])})[0][0] > 1.8
        for window in [encoding, *encoding.overflowing])
