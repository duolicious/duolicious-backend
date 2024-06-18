import onnxruntime as ort
import numpy as np
from PIL import Image
import sys
import json
from io import BytesIO
from concurrent.futures import ThreadPoolExecutor
from urllib.request import urlopen
import traceback
from pathlib import Path
from typing import List, Dict, Union, Any

_IMAGE_SIZE: tuple[int, int] = (299, 299)

_CATEGORIES: List[str] = [
    'drawings',
    'hentai',
    'neutral',
    'porn',
    'sexy',
]

_MODEL_PATH: Path = (
    Path(__file__).parent.parent /
    'antiporn' /
    'model.onnx'
)

if not _MODEL_PATH.exists():
    raise FileNotFoundError(f"Can't find model at {_MODEL_PATH}")

# Initialize the session globally
SESSION: ort.InferenceSession = ort.InferenceSession(str(_MODEL_PATH))
INPUT_NAME: str = SESSION.get_inputs()[0].name

def download_image(url: str) -> BytesIO:
    ''' Downloads an image and returns a BytesIO object containing its data. '''
    with urlopen(url) as response:
        return BytesIO(response.read())

def download_images_parallel(image_urls: List[str], max_workers: int = 5) -> List[BytesIO]:
    ''' Downloads multiple images in parallel and returns their data as BytesIO objects. '''
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        return list(executor.map(download_image, image_urls))

def preprocess_image(data: BytesIO) -> Union[np.ndarray, None]:
    ''' Converts image data into a numpy array suitable for model input. '''
    try:
        image = Image.open(data).convert('RGB').resize(_IMAGE_SIZE, Image.Resampling.NEAREST)
        return np.array(image).astype('float32') / 255
    except Exception as e:
        print(traceback.format_exc())
        return None

def process_images(image_data: List[BytesIO]) -> np.ndarray:
    ''' Processes multiple images for model inference. '''
    maybe_preprocessed_images = [
        preprocess_image(data) for data in image_data]

    preprocessed_images = [
        data for data in maybe_preprocessed_images if data is not None]

    return np.asarray(preprocessed_images)

def predict(loaded_images: np.ndarray) -> np.ndarray:
    ''' Runs the model prediction on loaded images. '''
    return SESSION.run(None, {INPUT_NAME: loaded_images})[0]

def format_predictions(predictions: np.ndarray) -> List[Dict[str, float]]:
    ''' Formats model predictions into a structured dictionary. '''
    preds = np.argsort(predictions, axis=1).tolist()

    probs = [
        [float(predictions[i][pred]) for pred in single_preds]
        for i, single_preds in enumerate(preds)]

    return [
        {_CATEGORIES[pred]: probs[i][j] for j, pred in enumerate(preds[i])}
        for i in range(len(preds))]

def apply_threshold(image_predictions: Dict[str, Dict[str, float]], threshold: float) -> List[bool]:
    ''' Classifies images as NSFW based on probabilities. '''
    return [
        (data.get('porn', 0) + data.get('hentai', 0)) >= threshold
        for data in image_predictions.values()
    ]

def classify_nsfw(image_urls: List[str], nsfw_threshold: float = 0.9) -> List[bool]:
    image_data = download_images_parallel(image_urls)
    loaded_images = process_images(image_data)
    predictions = predict(loaded_images)
    image_predictions = dict(zip(image_urls, format_predictions(predictions)))
    return apply_threshold(image_predictions, threshold=nsfw_threshold)

if __name__ == '__main__':
    image_urls = sys.argv[1:]
    results = classify_nsfw(image_urls, nsfw_threshold=0.9)
    print(json.dumps(results, indent=2))
