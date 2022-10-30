export const sha1 = async (str: string): Promise<string> => {
  const digest = await crypto.subtle.digest(
    "SHA-1",
    new TextEncoder().encode(str),
  );
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};
export const checksum = async (str: string): Promise<number> =>
  parseInt((await sha1(str)).slice(0, 8), 16);
