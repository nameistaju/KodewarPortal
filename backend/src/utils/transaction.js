export const runInTransaction = async (work) => {
  return await work(null);
};
