function c(e) {
  return ({ name: r, append: o }) => {
    typeof o == "string" && (e += `
${o}`);
    let t;
    try {
      const i = new Blob([e], { type: "text/javascript" });
      if (t = (globalThis.URL || globalThis.webkitURL).createObjectURL(i), !t)
        throw new Error("Failed to create object URL");
      const a = new Worker(t, { name: r });
      return a.addEventListener("error", () => {
        t && (globalThis.URL || globalThis.webkitURL).revokeObjectURL(t);
      }), a;
    } catch {
      return new Worker(
        `data:text/javascript;charset=utf-8,${encodeURIComponent(e)}`,
        { name: r }
      );
    } finally {
      t && (globalThis.URL || globalThis.webkitURL).revokeObjectURL(t);
    }
  };
}
export {
  c
};
