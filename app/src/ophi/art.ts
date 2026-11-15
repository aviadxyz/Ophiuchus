// Checks for static art files in public/ophi at build time
const artFiles = import.meta.glob('../../public/ophi/*.png', { eager: true })

export function hasArtImage(filename: string): boolean {
  return Object.keys(artFiles).some((path) => path.endsWith(`/${filename}`))
}
