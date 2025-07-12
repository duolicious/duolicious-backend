def human_readable_size_metric(size_bytes):
    # Define suffixes for metric prefixes
    suffixes = ['B', 'kB', 'MB', 'GB', 'TB', 'PB', 'EB']
    i = 0
    while size_bytes >= 1000 and i < len(suffixes) - 1:
        size_bytes /= 1000.0
        i += 1
    return f"{size_bytes:.1f} {suffixes[i]}"


def truncate_text(
    text: str,
    max_chars: int = 300,
    max_newlines: int = 20,
) -> str:
    ellipsis = "..."
    original = text

    # Truncate by `max_newlines`
    lines = text.splitlines()
    text = '\n'.join(lines[:max_newlines])

    # Truncate by `max_chars`
    text = text[:max_chars - len(ellipsis)]

    text = text.strip()

    # Add the ellipsis if needed
    text = text if text == original else text + ellipsis

    return text
