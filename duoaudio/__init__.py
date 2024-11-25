import io
import subprocess
import tempfile
from pathlib import Path

def transcode_and_trim_audio(input_audio: io.BytesIO, duration: int) -> io.BytesIO:
    # Ensure input audio is not empty
    if input_audio.getbuffer().nbytes == 0:
        raise ValueError("Input audio buffer is empty.")

    # Prepare the output buffer for the transcoded and trimmed audio
    output_audio = io.BytesIO()

    # Create a temporary directory to store input and output files
    with tempfile.TemporaryDirectory() as temp_dir:
        # Convert the temporary directory path to a Path object
        temp_dir_path = Path(temp_dir)

        # Define file paths for the temporary input and output files
        temp_input_file_path = temp_dir_path / 'input_audio'
        temp_output_file_path = temp_dir_path / 'output_audio.aac'

        # Write the input audio data to the temporary input file
        with temp_input_file_path.open('wb') as temp_input_file:
            temp_input_file.write(input_audio.getvalue())

        # FFmpeg command to transcode audio with settings optimized for voice data
        ffmpeg_cmd = [
            'ffmpeg',
            '-i',   str(temp_input_file_path),  # Read from temporary input file
            '-t',   str(duration),              # Set duration
            '-c:a', 'aac',                      # Use AAC codec
            '-b:a', '128k',                     # Bitrate
            '-ar',  '44100',                    # Sample rate
            '-ac',  '1',                        # Set audio to mono
            '-f',   'adts',                     # Set format to AAC
            str(temp_output_file_path)          # Output to temporary output file
        ]

        # Run FFmpeg as a subprocess
        process = subprocess.run(
            ffmpeg_cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )

        # Check if the transcoding was successful
        if process.returncode != 0:
            raise RuntimeError(f"FFmpeg error: {process.stderr.decode()}")

        # Check for empty output
        if not temp_output_file_path.exists() or temp_output_file_path.stat().st_size == 0:
            raise RuntimeError(
                "FFmpeg produced an empty output file.\n"
                f"stderr was {process.stderr.decode()}"
            )

        # Read the transcoded audio from the output file into the output buffer
        with temp_output_file_path.open('rb') as temp_output_file:
            output_audio.write(temp_output_file.read())

    # Reset buffer position to the start
    output_audio.seek(0)

    return output_audio
