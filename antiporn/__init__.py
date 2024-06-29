from PIL import Image
from typing import List
import numpy as np
import onnxruntime as ort
import argparse
from pathlib import Path
from io import BytesIO

_MODEL_PATH: Path = (
    Path(__file__).parent.parent /
    'antiporn' /
    'model.onnx'
)

if not _MODEL_PATH.exists():
    raise FileNotFoundError(f"Can't find model at {_MODEL_PATH}")

# Create a global ONNX runtime session
session = ort.InferenceSession(str(_MODEL_PATH))
input_name = session.get_inputs()[0].name

def preprocess_for_evaluation(image: Image.Image, image_size: int) -> np.array:
    """
    Preprocess image for evaluation
    Parameters
    ----------
    image : Image.Image
        Image to be preprocessed
    image_size : int
        Height/Width of image to be resized to
    dtype : str
        Dtype of image to be used
    Returns
    -------
    image : np.array
        Image ready for evaluation
    """
    image = pad_resize_image(image, image_size)
    image = np.array(image, dtype=np.float16)
    image -= 128
    image /= 128
    return image

def pad_resize_image(image: Image.Image, target_size: int) -> Image.Image:
    """
    Pad the image and resize it to target size using nearest neighbor interpolation.
    Parameters
    ----------
    image : Image.Image
        Image to be padded and resized
    target_size : int
        New size for the height/width of the image
    Returns
    -------
    resized_image : Image.Image
        Resized and padded image
    """
    old_size = image.size
    ratio = float(target_size) / max(old_size)
    new_size = tuple([int(x * ratio) for x in old_size])
    image = image.resize(new_size, Image.NEAREST)  # Use nearest neighbor interpolation
    new_im = Image.new("RGB", (target_size, target_size))
    new_im.paste(image, ((target_size - new_size[0]) // 2, (target_size - new_size[1]) // 2))
    return new_im

def read_image_from_bytes(image_data: BytesIO) -> np.array:
    """
    Load and preprocess image from a BytesIO object for inference without adding batch dimension
    Parameters
    ----------
    image_data : BytesIO
        Image data as BytesIO object
    Returns
    -------
    image : np.array
        Image ready for inference, not adding batch dimension here
    """
    image = Image.open(image_data)
    image = image.convert('RGB')
    image = preprocess_for_evaluation(image, 480)
    image = np.array(image)
    image = image.flatten()  # Flatten the image to a rank 1 array
    return image

def predict_nsfw(image_data_list: List[BytesIO]) -> List[float]:
    """
    Predict NSFW content in given images using batch processing.
    Parameters
    ----------
    image_data_list : List[BytesIO]
        List of image data as BytesIO objects
    Returns
    -------
    scores : List[float]
        List of NSFW scores for each image
    """
    if not image_data_list:
        return []

    # Prepare the batch of images
    batch_images = np.array([
        read_image_from_bytes(image_data)
        for image_data in image_data_list
    ], dtype=np.float16)

    # Run the batch prediction
    preds = session.run(None, {input_name: batch_images})

    # Extract scores and convert to float for compatibility with databases or other operations
    scores = [float(score[0]) for score in preds[0]]
    return scores
