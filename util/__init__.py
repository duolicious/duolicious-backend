def human_readable_size_metric(size_bytes):
    # Define suffixes for metric prefixes
    suffixes = ['B', 'kB', 'MB', 'GB', 'TB', 'PB', 'EB']
    i = 0
    while size_bytes >= 1000 and i < len(suffixes) - 1:
        size_bytes /= 1000.0
        i += 1
    return f"{size_bytes:.1f} {suffixes[i]}"


def truncate_text(text: str, limit: int = 100) -> str:
    """
    Return `text` unchanged if its length ≤ `limit`.
    Otherwise return the first `limit - len(ellipsis)` characters
    followed by `ellipsis`, so the total length equals `limit`.

    Works on Unicode code-points (Python str), not bytes.
    """
    ellipsis = '...'

    if len(text) <= limit:
        return text
    return text[: limit - len(ellipsis)] + ellipsis
