from collections import defaultdict
import json
import math
import nltk
import regex
import os
import urllib.request
import tarfile
import glob
import string

def emojis():
    # Emoticons range
    emoji_list = [chr(code) for code in range(0x1F600, 0x1F64F)]

    # Misc symbols and pictographs
    emoji_list += [chr(code) for code in range(0x1F300, 0x1F5FF)]

    return emoji_list


def download_opus100(output_dir):
    """
    Downloads and extracts the OPUS-100 data for the specified language pair.
    """
    base_url = "https://object.pouta.csc.fi/OPUS-100/v1.0/"
    src_file = "opus-100-corpus-v1.0.tar.gz"

    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    compressed_file_path = os.path.join(output_dir, src_file)

    # Check if the file already exists
    if not os.path.exists(compressed_file_path):
        print(f"Downloading {src_file}...")
        url = base_url + src_file
        try:
            with urllib.request.urlopen(url) as response:
                if response.status != 200:
                    raise Exception(f"Failed to download {url}. HTTP Status Code: {response.status}")
                with open(compressed_file_path, "wb") as f:
                    f.write(response.read())
        except Exception as e:
            raise Exception(f"Error during download: {e}")
    else:
        print(f"File {src_file} already exists. Skipping download.")

    if not os.path.exists(f'{output_dir}/opus-100-corpus'):
        print(f"Extracting {src_file}...")
        with tarfile.open(compressed_file_path, "r:gz") as tar:
            tar.extractall(path=output_dir)
        print(f"Data extracted to {output_dir}")
    else:
        print(f"File {output_dir} already exists. Skipping extraction.")

    extracted_dir = os.path.join(output_dir, "opus-100-corpus", "v1.0", "supervised")

    return extracted_dir


def read_data(file_path):
    """
    Reads the content of a file into a string.
    """
    with open(file_path, "r", encoding="utf-8") as f:
        return f.read()


def get_raw_corpus():
    output_dir = "/tmp/opus100_data"
    extracted_dir = download_opus100(output_dir)

    glob_path = os.path.join(extracted_dir, "*/*.*")
    file_paths = glob.glob(os.path.join(glob_path))

    logographic_languages = ['.zh', '.ja']

    corpus_parts = []
    for file_path in file_paths:
        if file_path.endswith('.en'):
            max_part_size = int(1e5)
        elif any(file_path.endswith(l) for l in logographic_languages):
            max_part_size = int(1e9)
        else:
            max_part_size = int(1e6)

        print(f"Reading file: {file_path}")

        truncated_part = read_data(file_path)[:max_part_size]
        corpus_parts.append(truncated_part)

    corpus = '\n'.join(corpus_parts)

    print(f"Corpus constructed with length: {len(corpus)}")

    return corpus


def get_corpus():
    text: str = get_raw_corpus()

    before_length = len(text)

    # Repeated word characters
    _pattern1 = regex.compile(r'(.)\1{2,}')
    _pattern2 = regex.compile(r'''( ) +''')
    _pattern3 = regex.compile(r'''([0-9])[0-9]+''')
    _pattern4 = regex.compile(r'''(\p{Emoji_Presentation})\p{Emoji_Presentation}+''')

    print('Cleaning corpus: Pass 1...')
    text = _pattern1.sub(r'\1\1', text)

    print('Cleaning corpus: Pass 2...')
    text = _pattern2.sub(r'\1', text)

    print('Cleaning corpus: Pass 3...')
    text = _pattern3.sub(r'\1', text)

    print('Cleaning corpus: Pass 4...')
    text = _pattern4.sub(r'\1', text)

    after_length = len(text)

    print(
            'Corpus cleaning finished with percent of corpus left:',
            100.0 * after_length / before_length)

    print('Augmenting corpus')
    extra_text = []
    extra_text += [
            f' {emoji}\n'
            for emoji in emojis()]
    extra_text += [
            f'{letter}{emoji}\n'
            for letter in string.ascii_letters
            for emoji in emojis()]

    text = ''.join([text] + extra_text)

    return text


def compute_bigram_probs():
    """Compute bigram probabilities from the corpus."""
    corpus = get_corpus()

    # Convert corpus into individual characters
    tokens = list(corpus)

    bigrams = nltk.bigrams(tokens)
    bigram_freq = defaultdict(int)
    unigram_freq = defaultdict(int)

    # Count bigram and unigram frequencies
    for w1, w2 in bigrams:
        bigram_freq[(w1, w2)] += 1
        unigram_freq[w1] += 1

    # Compute probabilities
    bigram_probs = {}
    for (w1, w2), count in bigram_freq.items():
        denominator = unigram_freq[w1]
        bigram_probs[(w1, w2)] = count / denominator if denominator > 0 else 1e-20

    return bigram_probs


def save_bigram_probs(bigram_probs, filename="bigram_probabilities.json"):
    """Save bigram probabilities to a JSON file in the same directory as the script."""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    file_path = os.path.join(script_dir, filename)
    with open(file_path, "w") as f:
        json.dump({json.dumps(k): v for k, v in bigram_probs.items()}, f)


def load_bigram_probs(filename="bigram_probabilities.json"):
    """Load bigram probabilities from a JSON file in the same directory as the script."""
    print('Loading bigram model...')
    script_dir = os.path.dirname(os.path.abspath(__file__))
    file_path = os.path.join(script_dir, filename)
    with open(file_path, "r") as f:
        data = json.load(f)
    # Deserialize the keys back to tuples
    probs = {tuple(json.loads(k)): v for k, v in data.items()}
    print('Bigram model loaded')
    return probs


def string_probability(s, bigram_probs):
    """Compute the probability of a string based on bigram probabilities."""
    # We need at least 2 chars for a bigram
    if len(s) < 2:
        # Handle short strings gracefully
        return math.log(1e-6)

    prob = 0.0
    for i in range(len(s) - 1):
        bigram = (s[i], s[i + 1])
        if bigram in bigram_probs:
            prob += math.log(bigram_probs[bigram])  # Log-probability
        else:
            prob += math.log(1e-6)  # Assign small probability to unseen bigrams
    return prob


def _normalize_short_emoji_runs(text):
    _pattern = regex.compile(
            r'(?<=\s|^)(\p{Emoji_Presentation})\p{Emoji_Presentation}{0,2}(?=\s|$)')
    return _pattern.sub(r'\1', text)


def _normalize_short_newline_runs(text):
    _pattern = regex.compile(r'([\n\r])[\n\r]{0,2}')
    return _pattern.sub(r'\1', text)


def has_gibberish(text, window_size=10, prob_threshold=-50):
    """Detect unlikely text based on bigram probabilities"""

    # The bigram model assigns low probabilities to emojis. This is good for
    # filtering spam comprised of long emoji runs. But a few consecutive emojis
    # are common in online speech. So we'll normalize strings to allow moderate
    # emoji use. It'd be preferable to have this handled by the model, but
    # bigram models don't take enough context into consideration.
    text = _normalize_short_emoji_runs(text)
    text = _normalize_short_newline_runs(text)

    if len(text) == 0:
        return False

    if len(text) < window_size:
        prob = string_probability(text, bigram_probs) / len(text) * window_size
        return prob < prob_threshold

    for i in range(len(text) - window_size + 1):
        window = text[i:i + window_size]

        prob = string_probability(window, bigram_probs)

        if prob < prob_threshold:
            return True

    return False

def train_model():
    bigram_probs = compute_bigram_probs()
    save_bigram_probs(bigram_probs)


if __name__ == "__main__":
    # Precompute and save bigram probabilities
    train_model()
else:
    # Load bigram probabilities for use

    # TODO
    # bigram_probs = load_bigram_probs()
    bigram_probs = None
