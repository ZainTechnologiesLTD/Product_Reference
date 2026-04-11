/**
 * Product Management Utilities
 * 
 * This module provides utility functions for product operations including
 * reference generation, validation, and data transformation.
 */

interface Product {
  id: number;
  name: string;
  category: string;
  reference: string;
}

/**
 * Generate a unique product reference code based on category
 * Format: [Category Prefix (2 chars)][Random 3-digit number]
 * Example: CA593, EL214
 */
export function generateReference(category: string): string {
  if (!category || category.length === 0) {
    return 'XX' + Math.floor(Math.random() * 900 + 100);
  }
  const prefix = category.substring(0, 2).toUpperCase();
  const numbers = Math.floor(Math.random() * 900) + 100;
  return `${prefix}${numbers}`;
}

/**
 * Check if a product name already exists in the product list
 * Returns the row number (1-indexed) if found, null otherwise
 */
export function findDuplicateProduct(
  products: Product[],
  name: string
): number | null {
  const index = products.findIndex(
    p => p.name.toLowerCase() === name.toLowerCase()
  );
  return index !== -1 ? index + 1 : null;
}

/**
 * Filter products based on search term
 * Searches across name, category, and reference fields
 */
export function filterProducts(
  products: Product[],
  searchTerm: string
): Product[] {
  if (!searchTerm.trim()) return products;

  const term = searchTerm.toLowerCase();
  return products.filter(p =>
    p.name.toLowerCase().includes(term) ||
    p.category.toLowerCase().includes(term) ||
    p.reference.toLowerCase().includes(term)
  );
}

/**
 * Get unique categories from product list
 */
export function getUniqueCategories(products: Product[]): string[] {
  return Array.from(new Set(products.map(p => p.category)));
}

/**
 * Get category suggestions based on input
 */
export function getCategorySuggestions(
  products: Product[],
  input: string
): string[] {
  if (!input.trim()) return [];

  const uniqueCategories = getUniqueCategories(products);
  return uniqueCategories.filter(cat =>
    cat.toLowerCase().includes(input.toLowerCase())
  );
}

/**
 * Get product name suggestions based on input
 */
export function getProductSuggestions(
  products: Product[],
  input: string
): Product[] {
  if (!input.trim()) return [];

  return products.filter(p =>
    p.name.toLowerCase().includes(input.toLowerCase())
  );
}

/**
 * Validate product data
 */
export function validateProduct(product: {
  name?: string;
  category?: string;
}): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!product.name || !product.name.trim()) {
    errors.push('Product name is required');
  }

  if (!product.category || !product.category.trim()) {
    errors.push('Category is required');
  }

  if (product.name && product.name.trim().length > 100) {
    errors.push('Product name must be less than 100 characters');
  }

  if (product.category && product.category.trim().length > 50) {
    errors.push('Category must be less than 50 characters');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Parse Excel/CSV content and extract products
 */
export function parseExcelContent(content: string): Product[] {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/html');
    const rows = doc.querySelectorAll('table tr');

    const importedProducts: Product[] = [];
    let idCounter = Date.now();

    for (let i = 1; i < rows.length; i++) {
      const cells = rows[i].querySelectorAll('td');
      if (cells.length >= 3) {
        const name = cells[0].textContent?.trim() || '';
        const category = cells[1].textContent?.trim() || '';
        const reference = cells[2].textContent?.trim() || '';

        if (name && category && reference) {
          importedProducts.push({
            id: idCounter++,
            name,
            category,
            reference
          });
        }
      }
    }

    return importedProducts;
  } catch (error) {
    console.error('Error parsing Excel content:', error);
    return [];
  }
}

/**
 * Generate Excel HTML content from products
 */
export function generateExcelContent(products: Product[]): string {
  return `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
    <head><meta charset="UTF-8"></head>
    <body>
      <table border="1">
        <thead>
          <tr>
            <th>Product Name</th>
            <th>Category</th>
            <th>Reference</th>
          </tr>
        </thead>
        <tbody>
          ${products.map(p => `
            <tr>
              <td>${p.name}</td>
              <td>${p.category}</td>
              <td>${p.reference}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </body>
    </html>
  `;
}

/**
 * Download Excel file
 */
export function downloadExcelFile(
  content: string,
  filename: string = 'products_backup.xls'
): void {
  const blob = new Blob([content], { type: 'application/vnd.ms-excel' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}
