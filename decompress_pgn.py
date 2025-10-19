#!/usr/bin/env python3
"""
Decompress Lichess PGN database from .zst format
Based on Sebastian Lague's approach to chess bot training
"""

import zstandard as zstd
import os
import sys

def decompress_lichess_pgn(input_file, output_file):
    """Decompress a .zst file to plain text PGN"""
    
    print(f"🔓 Decompressing {input_file}...")
    print(f"📁 Output will be saved to: {output_file}")
    
    # Check if input file exists
    if not os.path.exists(input_file):
        print(f"❌ Error: Input file '{input_file}' not found!")
        return False
    
    try:
        # Get file size for progress tracking
        input_size = os.path.getsize(input_file)
        print(f"📊 Input file size: {input_size / (1024*1024):.1f} MB")
        
        # Open compressed file
        with open(input_file, 'rb') as compressed_file:
            # Create Zstandard decompressor
            dctx = zstd.ZstdDecompressor()
            
            # Decompress and write to output file
            with open(output_file, 'wb') as output:
                # Stream decompress for large files
                dctx.copy_stream(compressed_file, output)
        
        # Get output file size
        output_size = os.path.getsize(output_file)
        print(f"✅ Successfully decompressed!")
        print(f"📊 Output file size: {output_size / (1024*1024):.1f} MB")
        print(f"📈 Compression ratio: {input_size/output_size:.2f}x")
        
        return True
        
    except Exception as e:
        print(f"❌ Error during decompression: {e}")
        return False

def main():
    input_file = "lichess_db_standard_rated_2016-03.pgn.zst"
    output_file = "lichess_games_2016.pgn"
    
    print("🧠 Lichess PGN Database Decompressor")
    print("=" * 50)
    
    if decompress_lichess_pgn(input_file, output_file):
        print("\n🎉 Decompression complete!")
        print(f"📋 You can now use '{output_file}' with the PGN processor")
        print("🌐 Go to: http://localhost:2000/process-pgn.html")
        print("📁 Upload the decompressed .pgn file")
    else:
        print("\n💥 Decompression failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()
