#!/usr/bin/env bash

# Usage: ./rand-sound.sh [DURATION_SECONDS=3] > output.wav
# Generate a small, random .wav file in bash

# Set parameters
SampleRate=8000          # Sampling rate in Hz
BitsPerSample=8          # Bits per sample
NumChannels=1            # Mono audio
DurationSeconds=${1:-3}  # Duration in seconds

# Calculate derived values
NumSamples=$((SampleRate * DurationSeconds))
Subchunk2Size=$((NumSamples * NumChannels * BitsPerSample / 8))
ByteRate=$((SampleRate * NumChannels * BitsPerSample / 8))
BlockAlign=$((NumChannels * BitsPerSample / 8))
ChunkSize=$((36 + Subchunk2Size))

# Function to write a 4-byte little-endian integer
write_little_endian_4bytes() {
    echo -ne "\\x$(printf '%02x' $(( $1        & 0xFF )))"
    echo -ne "\\x$(printf '%02x' $(( ($1 >> 8) & 0xFF )))"
    echo -ne "\\x$(printf '%02x' $(( ($1 >>16) & 0xFF )))"
    echo -ne "\\x$(printf '%02x' $(( ($1 >>24) & 0xFF )))"
}

# Function to write a 2-byte little-endian integer
write_little_endian_2bytes() {
    echo -ne "\\x$(printf '%02x' $(( $1        & 0xFF )))"
    echo -ne "\\x$(printf '%02x' $(( ($1 >> 8) & 0xFF )))"
}

# Write RIFF header
echo -n "RIFF"
write_little_endian_4bytes $ChunkSize
echo -n "WAVE"

# Write fmt subchunk
echo -n "fmt "
write_little_endian_4bytes 16             # Subchunk1Size for PCM
write_little_endian_2bytes 1              # AudioFormat (1 for PCM)
write_little_endian_2bytes $NumChannels   # NumChannels
write_little_endian_4bytes $SampleRate    # SampleRate
write_little_endian_4bytes $ByteRate      # ByteRate
write_little_endian_2bytes $BlockAlign    # BlockAlign
write_little_endian_2bytes $BitsPerSample # BitsPerSample

# Write data subchunk
echo -n "data"
write_little_endian_4bytes $Subchunk2Size

# Append random data
dd if=/dev/urandom bs=1 count=$Subchunk2Size status=none
