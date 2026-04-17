export async function loadSplats(url: string) {
    const res = await fetch(url);
    return await res.json();
  }