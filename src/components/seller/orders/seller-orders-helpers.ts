export function parseShippingAddress(address: string, detail?: string): { postal_code: string; address1: string; address2: string } {
  if (!address) return { postal_code: '', address1: '', address2: detail || '' }
  try {
    const parsed = JSON.parse(address)
    return {
      postal_code: parsed.postal_code || parsed.zipcode || '',
      address1: parsed.address1 || parsed.address || '',
      address2: parsed.address2 || parsed.detail || detail || '',
    }
  } catch {
    return { postal_code: '', address1: address, address2: detail || '' }
  }
}
