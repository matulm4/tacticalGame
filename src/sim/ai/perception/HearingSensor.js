/**
 * Copies the sounds the sound system delivered to an agent this tick into its
 * working memory. The loudest one wins, since that is the one that grabs attention.
 */
export function hearSounds(memory, sounds, time) {
  let loudest = null;
  for (const sound of sounds) {
    if (loudest === null || sound.loudness > loudest.loudness) loudest = sound;
  }
  if (loudest) memory.hear(loudest, time);
}
