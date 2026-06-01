import { signExtend16Bit, signExtend8Bit } from "./tools";

const EOF = -1;

/*
 * Take an array of unsigned byte data and present it as a stream with various methods
 * for reading data in different formats.
 */
export class ArrayDataStream {
  data: Uint8Array;
  eof = false;
  start: number;
  end: number;
  pos: number;

  // Assigned on the prototype below so `ArrayDataStream.prototype.EOF` keeps working.
  declare EOF: number;

  constructor(data: Uint8Array, start?: number, end?: number) {
    this.data = data;
    this.start = start === undefined ? 0 : start;
    this.end = end === undefined ? data.length : end;
    this.pos = this.start;
  }

  /**
   * Read a single byte from the string and turn it into a JavaScript string (assuming ASCII).
   *
   * @returns String containing one character, or EOF if the end of file was reached (eof flag
   * is set).
   */
  readChar(): string | number {
    if (this.pos < this.end) return String.fromCharCode(this.data[this.pos++]);

    this.eof = true;
    return EOF;
  }

  /**
   * Read one unsigned byte from the stream
   *
   * @returns Unsigned byte, or EOF if the end of file was reached (eof flag is set).
   */
  readByte(): number {
    if (this.pos < this.end) return this.data[this.pos++];

    this.eof = true;
    return EOF;
  }

  //Synonym:
  readU8(): number {
    return this.readByte();
  }

  readS8(): number {
    return signExtend8Bit(this.readByte());
  }

  unreadChar(_c: string | number): void {
    this.pos--;
  }

  peekChar(): string | number {
    if (this.pos < this.end) return String.fromCharCode(this.data[this.pos]);

    this.eof = true;
    return EOF;
  }

  /**
   * Read a (maximally 32-bit) unsigned integer from the stream which was encoded in Variable Byte format.
   *
   * @returns the unsigned integer, or 0 if a valid integer could not be read (EOF was reached or integer format
   * was invalid).
   */
  readUnsignedVB(): number {
    let b: number,
      shift = 0,
      result = 0;

    // 5 bytes is enough to encode 32-bit unsigned quantities
    for (let i = 0; i < 5; i++) {
      b = this.readByte();

      if (b === EOF) return 0;

      result = result | ((b & ~0x80) << shift);

      // Final byte?
      if (b < 128) {
        /*
         * Force the 32-bit integer to be reinterpreted as unsigned by doing an unsigned right shift, so that
         * the top bit being set doesn't cause it to interpreted as a negative number.
         */
        return result >>> 0;
      }

      shift += 7;
    }

    // This VB-encoded int is too long!
    return 0;
  }

  readSignedVB(): number {
    const unsigned = this.readUnsignedVB();

    // Apply ZigZag decoding to recover the signed value
    return (unsigned >>> 1) ^ -(unsigned & 1);
  }

  readString(length: number): string {
    const chars: Array<string | number> = new Array(length);
    let i;

    for (i = 0; i < length; i++) {
      chars[i] = this.readChar();
    }

    return chars.join("");
  }

  readS16(): number {
    const b1 = this.readByte(),
      b2 = this.readByte();

    return signExtend16Bit(b1 | (b2 << 8));
  }

  readU16(): number {
    const b1 = this.readByte(),
      b2 = this.readByte();

    return b1 | (b2 << 8);
  }

  readU32(): number {
    const b1 = this.readByte(),
      b2 = this.readByte(),
      b3 = this.readByte(),
      b4 = this.readByte();
    return b1 | (b2 << 8) | (b3 << 16) | (b4 << 24);
  }

  /**
   * Search for the string 'needle' beginning from the current stream position up
   * to the end position. Return the offset of the first occurrence found.
   *
   * @param needle
   *            String to search for
   * @returns Position of the start of needle in the stream, or -1 if it wasn't
   *          found
   */
  nextOffsetOf(needle: ArrayLike<number>): number {
    let i, j;

    for (i = this.pos; i <= this.end - needle.length; i++) {
      if (this.data[i] === needle[0]) {
        for (j = 1; j < needle.length && this.data[i + j] === needle[j]; j++);

        if (j === needle.length) return i;
      }
    }

    return -1;
  }
}

ArrayDataStream.prototype.EOF = EOF;
