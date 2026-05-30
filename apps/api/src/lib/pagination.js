// Helpers de paginación para listados admin.
// Contrato: si la query trae `page`, el endpoint devuelve un envelope
//   { items, total, page, pageSize, totalPages }
// Si NO trae `page`, el handler mantiene su respuesta legacy (array) → no rompe
// a los consumidores existentes que aún no paginan.

function parsePagination(query, { defaultPageSize = 50, maxPageSize = 100 } = {}) {
  const hasPage = query && query.page !== undefined;
  let page = parseInt(query?.page, 10);
  let pageSize = parseInt(query?.pageSize, 10);
  if (!Number.isFinite(page) || page < 1) page = 1;
  if (!Number.isFinite(pageSize) || pageSize < 1) pageSize = defaultPageSize;
  pageSize = Math.min(pageSize, maxPageSize);
  return { hasPage, page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

// Ejecuta findMany + count en paralelo y arma el envelope.
async function paginate(model, findArgs, pg) {
  const { where } = findArgs;
  const [items, total] = await Promise.all([
    model.findMany({ ...findArgs, skip: pg.skip, take: pg.take }),
    model.count({ where }),
  ]);
  return {
    items,
    total,
    page: pg.page,
    pageSize: pg.pageSize,
    totalPages: Math.max(1, Math.ceil(total / pg.pageSize)),
  };
}

module.exports = { parsePagination, paginate };
