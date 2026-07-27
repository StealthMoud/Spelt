import os
import struct
import zlib

def write_fallback_png(path, size, color_rgba):
    """Writes a basic colored block PNG file using standard library only."""
    width, height = size, size
    raw_data = bytearray()
    for y in range(height):
        raw_data.append(0) # filter type 0
        for x in range(width):
            dx = x - width / 2
            dy = y - height / 2
            dist = (dx*dx + dy*dy) ** 0.5
            r, g, b, a = color_rgba
            if dist > (width / 2):
                raw_data.extend([0, 0, 0, 0])
            elif dist > (width / 2 - 2):
                alpha = int(a * (1 - (dist - (width / 2 - 2)) / 2))
                raw_data.extend([r, g, b, alpha])
            else:
                raw_data.extend([r, g, b, a])

    png_bytes = b'\x89PNG\r\n\x1a\n'
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    png_bytes += struct.pack('>I', len(ihdr_data)) + b'IHDR' + ihdr_data + struct.pack('>I', zlib.crc32(b'IHDR' + ihdr_data))
    compressed = zlib.compress(raw_data)
    png_bytes += struct.pack('>I', len(compressed)) + b'IDAT' + compressed + struct.pack('>I', zlib.crc32(b'IDAT' + compressed))
    png_bytes += struct.pack('>I', 0) + b'IEND' + struct.pack('>I', zlib.crc32(b'IEND'))

    with open(path, 'wb') as f:
        f.write(png_bytes)

def main():
    os.makedirs('icons', exist_ok=True)
    sizes = [16, 48, 128]
    # Spelt primary indigo: HSL(245, 80%, 62%) -> RGB(102, 85, 230)
    color = (102, 85, 230, 255)
    
    try:
        from PIL import Image, ImageDraw
        print("Using PIL to generate premium spell-tile icons...")
        for s in sizes:
            img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
            draw = ImageDraw.Draw(img)
            # Spelt base circle
            draw.ellipse([0, 0, s-1, s-1], fill=(102, 85, 230, 240))
            # Draw a spelling letter tile (rounded box in middle)
            pad = max(2, s // 5)
            draw.rounded_rectangle([pad, pad, s - pad - 1, s - pad - 1], radius=max(1, s//8), fill=(255, 255, 255, 255))
            # Draw a representation of text lines / checklist in the tile
            inner_pad = pad + max(2, s // 10)
            mid = s // 2
            # Draw vertical book spine or letter-tile representation
            draw.rectangle([mid - max(1, s//16), inner_pad, mid + max(1, s//16), s - inner_pad], fill=(102, 85, 230, 255))
            draw.rectangle([inner_pad, mid - max(1, s//16), s - inner_pad, mid + max(1, s//16)], fill=(102, 85, 230, 255))
            img.save(f'icons/icon-{s}.png')
    except ImportError:
        print("PIL not installed, using fallback PNG generator...")
        for s in sizes:
            write_fallback_png(f'icons/icon-{s}.png', s, color)

    print("Icons successfully generated inside icons/ directory.")

if __name__ == '__main__':
    main()
