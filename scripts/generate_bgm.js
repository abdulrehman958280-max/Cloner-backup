import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.join(__dirname, '..', 'public', 'audio');

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// Generate a 16-bit stereo PCM WAV file containing an atmospheric relaxing Lo-Fi Cyber Ambient Track (30 seconds looping)
const sampleRate = 44100;
const duration = 24; // 24 seconds loop
const numChannels = 2;
const totalSamples = sampleRate * duration;
const bytesPerSample = 2; // 16-bit
const blockAlign = numChannels * bytesPerSample;
const byteRate = sampleRate * blockAlign;
const dataSize = totalSamples * blockAlign;
const buffer = Buffer.alloc(44 + dataSize);

// RIFF Header
buffer.write('RIFF', 0);
buffer.writeUInt32LE(36 + dataSize, 4);
buffer.write('WAVE', 8);
buffer.write('fmt ', 12);
buffer.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
buffer.writeUInt16LE(1, 20);  // AudioFormat (1 for PCM)
buffer.writeUInt16LE(numChannels, 22);
buffer.writeUInt32LE(sampleRate, 24);
buffer.writeUInt32LE(byteRate, 28);
buffer.writeUInt16LE(blockAlign, 32);
buffer.writeUInt16LE(16, 34); // BitsPerSample
buffer.write('data', 36);
buffer.writeUInt32LE(dataSize, 40);

// Musical notes and chords (Cmaj9 -> Am9 -> Fmaj7 -> Gadd9)
const chordProgression = [
    { bass: 65.41, notes: [130.81, 164.81, 196.00, 246.94, 293.66], duration: 6 },  // C2, C3, E3, G3, B3, D4
    { bass: 55.00, notes: [110.00, 130.81, 164.81, 196.00, 246.94], duration: 6 },  // A1, A2, C3, E3, G3, B3
    { bass: 43.65, notes: [87.31, 130.81, 174.61, 220.00, 261.63], duration: 6 },   // F1, F2, C3, F3, A3, C4
    { bass: 49.00, notes: [98.00, 146.83, 196.00, 246.94, 293.66], duration: 6 }    // G1, G2, D3, G3, B3, D4
];

let offset = 44;

for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const chordIdx = Math.floor((t % duration) / 6);
    const chord = chordProgression[chordIdx];
    const chordT = (t % 6);

    // Warm envelope
    const env = Math.sin((chordT / 6) * Math.PI);

    let left = 0;
    let right = 0;

    // Sub Bass Sine
    const bassOsc = Math.sin(2 * Math.PI * chord.bass * t);
    left += bassOsc * 0.18 * env;
    right += bassOsc * 0.18 * env;

    // Chord pad voices with subtle detuning and stereo panning
    chord.notes.forEach((freq, nIdx) => {
        const pan = (nIdx % 2 === 0 ? 0.35 : -0.35);
        const osc1 = Math.sin(2 * Math.PI * freq * t);
        const osc2 = Math.sin(2 * Math.PI * (freq * 1.003) * t); // chorus
        const voice = (osc1 + osc2) * (0.06 / (nIdx + 1)) * env;

        left += voice * (1 - pan);
        right += voice * (1 + pan);
    });

    // Gentle high arpeggio / rain shimmer (pentatonic scale)
    const arpNotes = [523.25, 659.25, 783.99, 987.77, 1046.50, 1174.66];
    const arpStep = Math.floor(t * 3) % arpNotes.length;
    const arpFreq = arpNotes[arpStep];
    const arpEnv = Math.exp(-6 * ((t * 3) % 1));
    const arpOsc = Math.sin(2 * Math.PI * arpFreq * t);
    left += arpOsc * 0.035 * arpEnv;
    right += arpOsc * 0.035 * arpEnv;

    // Clamp
    left = Math.max(-1, Math.min(1, left));
    right = Math.max(-1, Math.min(1, right));

    // Convert to 16-bit integer
    const intL = Math.floor(left * 32767);
    const intR = Math.floor(right * 32767);

    buffer.writeInt16LE(intL, offset);
    buffer.writeInt16LE(intR, offset + 2);
    offset += 4;
}

const wavPath = path.join(outputDir, 'bgm.wav');
const mp3Path = path.join(outputDir, 'bgm.mp3');

fs.writeFileSync(wavPath, buffer);
// Also copy to bgm.mp3 as fallback
fs.writeFileSync(mp3Path, buffer);

console.log('Successfully generated atmospheric background audio files at', wavPath);
