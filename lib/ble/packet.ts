import { PacketType } from './constants';

const SOF = 0xaa;

/**
 * Compute CRC-8 for the length field (packet header integrity)
 */
function crc8(data: Uint8Array): number {
  let crc = 0;
  for (const byte of data) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) {
      if (crc & 0x80) {
        crc = (crc << 1) ^ 0x07;
      } else {
        crc <<= 1;
      }
    }
  }
  return crc & 0xff;
}

/**
 * Compute CRC-32 for packet payload integrity
 */
function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (~crc) >>> 0;
}

export class WhoopPacket {
  type: number;
  seq: number;
  cmd: number;
  data: Uint8Array;

  constructor(
    type: number,
    seq: number,
    cmd: number,
    data: Uint8Array = new Uint8Array()
  ) {
    this.type = type;
    this.seq = seq;
    this.cmd = cmd;
    this.data = data;
  }

  /**
   * Parse a raw BLE notification value into a WhoopPacket.
   */
  static fromData(data: Uint8Array): WhoopPacket {
    if (data.length < 8) {
      throw new Error('Packet too short');
    }

    if (data[0] !== SOF) {
      throw new Error(`Invalid SOF: 0x${data[0].toString(16)}`);
    }

    // Verify header CRC8
    const lengthBuffer = data.slice(1, 3);
    const expectedCrc8 = data[3];
    const calculatedCrc8 = crc8(lengthBuffer);

    if (calculatedCrc8 !== expectedCrc8) {
      throw new Error(
        `Invalid header CRC8: expected 0x${expectedCrc8.toString(16)}, got 0x${calculatedCrc8.toString(16)}`
      );
    }

    // Parse length (little-endian)
    const length = (data[2] << 8) | data[1];
    if (length > data.length || length < 8) {
      throw new Error('Invalid packet length');
    }

    // Extract payload and verify CRC32
    const pkt = data.slice(4, length);
    const crc32Bytes = data.slice(length, length + 4);
    const view = new DataView(
      crc32Bytes.buffer,
      crc32Bytes.byteOffset,
      crc32Bytes.byteLength
    );
    const expectedCrc32 = view.getUint32(0, true);
    const calculatedCrc32 = crc32(pkt);

    if (calculatedCrc32 !== expectedCrc32) {
      throw new Error(
        `Invalid CRC32: expected 0x${expectedCrc32.toString(16)}, got 0x${calculatedCrc32.toString(16)}`
      );
    }

    const type = pkt[0];
    const seq = pkt[1];
    const cmd = pkt[2];
    const payload = pkt.slice(3);

    return new WhoopPacket(type, seq, cmd, payload);
  }

  /**
   * Create the inner packet payload (type + seq + cmd + data)
   */
  private createPacket(): Uint8Array {
    const packet = new Uint8Array(3 + this.data.length);
    packet[0] = this.type;
    packet[1] = this.seq;
    packet[2] = this.cmd;
    packet.set(this.data, 3);
    return packet;
  }

  /**
   * Build a fully framed packet ready for BLE transmission.
   * Format: [SOF][Length:2 LE][CRC8][Type][Seq][Cmd][Data...][CRC32:4 LE]
   */
  framedPacket(): Uint8Array {
    const pkt = this.createPacket();
    const length = pkt.length + 4; // +4 for CRC32
    const lengthBuffer = new Uint8Array([length & 0xff, length >> 8]);
    const crc8Value = crc8(lengthBuffer);
    const crc32Value = crc32(pkt);
    const crc32Buffer = new Uint8Array([
      crc32Value & 0xff,
      (crc32Value >> 8) & 0xff,
      (crc32Value >> 16) & 0xff,
      (crc32Value >> 24) & 0xff,
    ]);

    const framed = new Uint8Array(1 + 2 + 1 + pkt.length + 4);
    framed[0] = SOF;
    framed.set(lengthBuffer, 1);
    framed[3] = crc8Value;
    framed.set(pkt, 4);
    framed.set(crc32Buffer, 4 + pkt.length);

    return framed;
  }

  /**
   * Convert packet bytes to hex string for debugging
   */
  static toHex(data: Uint8Array): string {
    return Array.from(data)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(' ');
  }
}

/**
 * Build a command packet ready for transmission
 */
export function buildCommand(
  cmd: number,
  data: Uint8Array = new Uint8Array([0x00])
): Uint8Array {
  return new WhoopPacket(PacketType.COMMAND, 0, cmd, data).framedPacket();
}
