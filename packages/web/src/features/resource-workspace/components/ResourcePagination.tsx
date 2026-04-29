import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ResourcePaginationProps {
  readonly page: number;
  readonly limit: number;
  readonly total: number;
  readonly onPageChange: (page: number) => void;
  readonly onLimitChange: (limit: number) => void;
}

export function ResourcePagination({
  page,
  limit,
  total,
  onPageChange,
  onLimitChange,
}: ResourcePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const isFirstPage = page === 1;
  const isLastPage = page >= totalPages;

  const handlePrevPage = () => {
    if (!isFirstPage) {
      onPageChange(page - 1);
    }
  };

  const handleNextPage = () => {
    if (!isLastPage) {
      onPageChange(page + 1);
    }
  };

  const handlePageClick = (targetPage: number) => {
    if (targetPage !== page && targetPage >= 1 && targetPage <= totalPages) {
      onPageChange(targetPage);
    }
  };

  const handleLimitChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newLimit = Number(event.target.value);
    onLimitChange(newLimit);
  };

  // 生成页码数组（最多显示 7 个页码）
  const getPageNumbers = (): number[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages: number[] = [];
    
    // 始终显示第一页
    pages.push(1);

    if (page <= 3) {
      // 当前页在前面
      pages.push(2, 3, 4, 5);
      pages.push(-1); // 省略号
      pages.push(totalPages);
    } else if (page >= totalPages - 2) {
      // 当前页在后面
      pages.push(-1); // 省略号
      pages.push(totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
    } else {
      // 当前页在中间
      pages.push(-1); // 省略号
      pages.push(page - 1, page, page + 1);
      pages.push(-1); // 省略号
      pages.push(totalPages);
    }

    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white/90 px-6 py-4 backdrop-blur-sm dark:border-gray-700 dark:bg-gray-900/90 sm:flex-row">
      {/* 每页数量选择器 */}
      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
        <label htmlFor="page-limit" className="whitespace-nowrap">
          每页显示
        </label>
        <select
          id="page-limit"
          value={limit}
          onChange={handleLimitChange}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        >
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
        <span className="whitespace-nowrap">条</span>
      </div>

      {/* 分页控件 */}
      <div className="flex items-center gap-2">
        {/* 上一页按钮 */}
        <button
          onClick={handlePrevPage}
          disabled={isFirstPage}
          aria-label="上一页"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 dark:disabled:hover:bg-gray-800"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {/* 页码按钮 */}
        <div className="flex items-center gap-1">
          {pageNumbers.map((pageNum, index) => {
            if (pageNum === -1) {
              return (
                <span
                  key={`ellipsis-${index}`}
                  className="inline-flex h-9 w-9 items-center justify-center text-gray-500 dark:text-gray-400"
                >
                  ...
                </span>
              );
            }

            const isActive = pageNum === page;

            return (
              <button
                key={pageNum}
                onClick={() => handlePageClick(pageNum)}
                className={`inline-flex h-9 min-w-[2.25rem] items-center justify-center rounded-lg px-3 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                }`}
              >
                {pageNum}
              </button>
            );
          })}
        </div>

        {/* 下一页按钮 */}
        <button
          onClick={handleNextPage}
          disabled={isLastPage}
          aria-label="下一页"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 dark:disabled:hover:bg-gray-800"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
