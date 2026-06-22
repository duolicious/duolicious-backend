# Usage: ./rand-image.sh WIDTH HEIGHT > out.bmp
# Generates a 24-bit BMP of random pixels to stdout.

raw_rand_bmp () {
  local width=$1
  local height=$2

  # Each row is width*3 bytes (24-bit = 3 bytes/pixel),
  # then padded to a multiple of 4.
  local row_size=$(( (width * 3 + 3) & ~3 ))
  local pixel_data_size=$((row_size * height))
  local file_size=$((54 + pixel_data_size))

  # ----------------------------------------------------------------------------
  # 1) BMP FILE HEADER (14 bytes)
  # ----------------------------------------------------------------------------
  # - Signature "BM" (2 bytes)
  printf "BM"

  # - File size (4 bytes, little-endian)
  printf "\\x$(printf '%02x' $((file_size       & 0xFF)))"
  printf "\\x$(printf '%02x' $(((file_size >> 8) & 0xFF)))"
  printf "\\x$(printf '%02x' $(((file_size >>16) & 0xFF)))"
  printf "\\x$(printf '%02x' $(((file_size >>24) & 0xFF)))"

  # - Reserved1 (2 bytes) = 0
  printf "\\x00\\x00"

  # - Reserved2 (2 bytes) = 0
  printf "\\x00\\x00"

  # - Offset to start of pixel data (4 bytes) = 54 decimal = 0x36
  #   (14-byte file header + 40-byte DIB header)
  printf "\\x36\\x00\\x00\\x00"

  # ----------------------------------------------------------------------------
  # 2) DIB HEADER: BITMAPINFOHEADER (40 bytes)
  # ----------------------------------------------------------------------------
  # - Header size (4 bytes) = 40
  printf "\\x28\\x00\\x00\\x00"

  # - Width (4 bytes, little-endian)
  printf "\\x$(printf '%02x' $(( width       & 0xFF)))"
  printf "\\x$(printf '%02x' $(((width >> 8) & 0xFF)))"
  printf "\\x$(printf '%02x' $(((width >>16) & 0xFF)))"
  printf "\\x$(printf '%02x' $(((width >>24) & 0xFF)))"

  # - Height (4 bytes, little-endian)
  #   Note: BMP stores rows from bottom to top if height is positive
  printf "\\x$(printf '%02x' $(( height       & 0xFF)))"
  printf "\\x$(printf '%02x' $(((height >> 8) & 0xFF)))"
  printf "\\x$(printf '%02x' $(((height >>16) & 0xFF)))"
  printf "\\x$(printf '%02x' $(((height >>24) & 0xFF)))"

  # - Planes (2 bytes) = 1
  printf "\\x01\\x00"

  # - Bits per pixel (2 bytes) = 24
  printf "\\x18\\x00"

  # - Compression (4 bytes) = 0 (BI_RGB)
  printf "\\x00\\x00\\x00\\x00"

  # - Image size (4 bytes) = 0 for uncompressed BI_RGB
  printf "\\x00\\x00\\x00\\x00"

  # - X pixels per meter (4 bytes) = 0 (you can put 2835 for ~72 DPI)
  printf "\\x00\\x00\\x00\\x00"

  # - Y pixels per meter (4 bytes) = 0
  printf "\\x00\\x00\\x00\\x00"

  # - Total colors (4 bytes) = 0
  printf "\\x00\\x00\\x00\\x00"

  # - Important colors (4 bytes) = 0
  printf "\\x00\\x00\\x00\\x00"

  # ----------------------------------------------------------------------------
  # 3) Pixel data (BGR, bottom-to-top). But random is fine either way.
  # ----------------------------------------------------------------------------
  #
  # We only need "row_size * height" bytes. We'll read that many from /dev/urandom.
  # That automatically includes the per-row padding. (We don't have to do anything special
  # as long as we read the right total number of bytes.)
  #
  # Because the BMP spec says rows are in bottom-to-top order, each row is
  # actually the last row in the file. But for random data, it makes no difference.
  #
  dd if=/dev/urandom bs="${pixel_data_size}" count=1 2>/dev/null
}

raw_rand_bmp "$@"
