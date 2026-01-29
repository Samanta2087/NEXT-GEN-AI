#!/usr/bin/env python3
"""
Simple background removal script using rembg
Usage: python remove_bg.py input_path output_path
"""

import sys
import os

def remove_background(input_path: str, output_path: str):
    """Remove background from image using rembg"""
    try:
        from rembg import remove
        from PIL import Image
        
        print(f"[RemoveBG] Loading image: {input_path}")
        
        # Open input image
        with open(input_path, 'rb') as inp:
            input_data = inp.read()
        
        print("[RemoveBG] Processing with AI model...")
        
        # Remove background
        output_data = remove(input_data)
        
        # Save output
        with open(output_path, 'wb') as out:
            out.write(output_data)
        
        print(f"[RemoveBG] Saved to: {output_path}")
        print(f"[RemoveBG] Output size: {os.path.getsize(output_path)} bytes")
        return True
        
    except ImportError as e:
        print(f"[RemoveBG] Import error: {e}")
        print("[RemoveBG] Please install: pip install rembg[cpu] pillow")
        return False
    except Exception as e:
        print(f"[RemoveBG] Error: {e}")
        return False

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python remove_bg.py <input_path> <output_path>")
        sys.exit(1)
    
    input_path = sys.argv[1]
    output_path = sys.argv[2]
    
    if not os.path.exists(input_path):
        print(f"[RemoveBG] Input file not found: {input_path}")
        sys.exit(1)
    
    success = remove_background(input_path, output_path)
    sys.exit(0 if success else 1)
