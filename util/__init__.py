def human_readable_size_metric(size_bytes):
    # Define suffixes for metric prefixes
    suffixes = ['B', 'kB', 'MB', 'GB', 'TB', 'PB', 'EB']
    i = 0
    while size_bytes >= 1000 and i < len(suffixes) - 1:
        size_bytes /= 1000.0
        i += 1
    return f"{size_bytes:.1f} {suffixes[i]}"
