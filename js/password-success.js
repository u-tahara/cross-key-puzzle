(() => {
  const normalizeString = (value) => {
    if (typeof value !== 'string') return '';
    return value.trim();
  };

  const buildDestination = (baseUrl, code) => {
    const url = normalizeString(baseUrl);
    if (!url) return '';
    const trimmedCode = normalizeString(code);
    if (!trimmedCode) {
      return url;
    }

    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}code=${encodeURIComponent(trimmedCode)}`;
  };

  const createSuccessNavigator = ({ successUrl, code, location } = {}) => {
    const targetLocation = location || (typeof window !== 'undefined' ? window.location : undefined);
    let hasNavigated = false;

    const navigate = () => {
      if (hasNavigated) return false;
      if (!targetLocation || typeof targetLocation.replace !== 'function') {
        return false;
      }

      const destination = buildDestination(successUrl, code);
      if (!destination) {
        return false;
      }

      hasNavigated = true;
      targetLocation.replace(destination);
      return true;
    };

    const getDestination = () => buildDestination(successUrl, code) || null;

    const getHasNavigated = () => hasNavigated;

    return {
      navigate,
      getDestination,
      hasNavigated: getHasNavigated,
    };
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { createSuccessNavigator };
  }

  if (typeof window !== 'undefined') {
    window.PasswordSuccess = window.PasswordSuccess || {};
    window.PasswordSuccess.createSuccessNavigator = createSuccessNavigator;
  }
})();
