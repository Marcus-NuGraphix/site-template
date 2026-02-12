const ENDPOINT = '/delete-my-data/submit.php';
const MIN_SUBMIT_SECONDS = 3;
const SUCCESS_STORAGE_KEY = 'delete-request-last-success';

export function initDeleteRequestForm() {
  const form = document.querySelector('[data-delete-request-form]');
  if (!(form instanceof HTMLFormElement)) {
    return;
  }

  if (form.hasAttribute('data-form-disabled') || form.hidden) {
    return;
  }

  const status = form.querySelector('[data-form-status]');
  const submitButton = form.querySelector('button[type="submit"]');
  const honeypot = form.querySelector('input[name="company"]');
  const submittedAtInput = form.querySelector('[data-submitted-at]');
  const referenceIdInput = form.querySelector('[data-reference-id]');
  const errorSummary = form.querySelector('[data-form-error-summary]');
  const errorList = form.querySelector('[data-form-error-list]');
  const successPanel = form.querySelector('[data-form-success]');
  const referenceOutput = form.querySelector('[data-reference-output]');

  if (!(submitButton instanceof HTMLButtonElement)) {
    return;
  }

  const submitLabel = (submitButton.getAttribute('data-submit-label') || submitButton.textContent || 'Submit request').trim();

  const validatableFields = Array.from(form.querySelectorAll('input, textarea, select'))
    .filter((field) => field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement)
    .filter((field) => field.name !== 'company' && field.name !== 'submitted_at' && field.name !== 'reference_id');

  const charCounters = Array.from(form.querySelectorAll('[data-char-counter]'))
    .map((counter) => {
      if (!(counter instanceof HTMLElement)) {
        return null;
      }

      const fieldId = counter.getAttribute('data-for') || '';
      const field = form.querySelector(`#${fieldId}`);
      if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)) {
        return null;
      }

      const max = Number.parseInt(counter.getAttribute('data-max') || '', 10);
      if (!Number.isFinite(max) || max <= 0) {
        return null;
      }

      return { counter, field, max };
    })
    .filter(Boolean);

  const supportsAsyncSubmit = typeof window.fetch === 'function' && typeof window.FormData === 'function';
  const escapeSelector = (value) => {
    if (window.CSS && typeof window.CSS.escape === 'function') {
      return window.CSS.escape(value);
    }

    return String(value).replace(/["\\]/g, '\\$&');
  };

  let isSubmitting = false;

  const setStatus = (message, state = '') => {
    if (!(status instanceof HTMLElement)) {
      return;
    }

    status.textContent = message;
    status.className = state ? `form-status ${state}` : 'form-status';
  };

  const setSubmittingState = (busy) => {
    isSubmitting = busy;
    submitButton.disabled = busy;
    submitButton.setAttribute('aria-busy', busy ? 'true' : 'false');
    submitButton.textContent = busy ? 'Submitting...' : submitLabel;
  };

  const stampSubmitTime = () => {
    if (submittedAtInput instanceof HTMLInputElement) {
      submittedAtInput.value = String(Math.floor(Date.now() / 1000));
    }
  };

  const getElapsedSeconds = () => {
    if (!(submittedAtInput instanceof HTMLInputElement)) {
      return MIN_SUBMIT_SECONDS;
    }

    const submittedAt = Number.parseInt(submittedAtInput.value, 10);
    if (!Number.isFinite(submittedAt) || submittedAt <= 0) {
      return 0;
    }

    return Math.floor(Date.now() / 1000) - submittedAt;
  };

  const issueReferenceId = () => {
    if (!(referenceIdInput instanceof HTMLInputElement)) {
      return '';
    }

    const value = createReferenceId();
    referenceIdInput.value = value;
    return value;
  };

  const showSuccess = (referenceId) => {
    if (!(successPanel instanceof HTMLElement) || !(referenceOutput instanceof HTMLElement)) {
      return;
    }

    referenceOutput.textContent = referenceId;
    successPanel.hidden = false;
  };

  const hideSuccess = () => {
    if (successPanel instanceof HTMLElement) {
      successPanel.hidden = true;
    }
  };

  const saveSuccess = (referenceId) => {
    try {
      sessionStorage.setItem(
        SUCCESS_STORAGE_KEY,
        JSON.stringify({
          referenceId,
          timestamp: Date.now(),
        })
      );
    } catch {
      // no-op
    }
  };

  const restoreSuccess = () => {
    try {
      const raw = sessionStorage.getItem(SUCCESS_STORAGE_KEY);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed.referenceId !== 'string' || typeof parsed.timestamp !== 'number') {
        return;
      }

      const ageMs = Date.now() - parsed.timestamp;
      if (ageMs > 24 * 60 * 60 * 1000) {
        sessionStorage.removeItem(SUCCESS_STORAGE_KEY);
        return;
      }

      showSuccess(parsed.referenceId);
      setStatus(`Last successful request reference: ${parsed.referenceId}`, 'is-success');
    } catch {
      // no-op
    }
  };

  const getErrorNode = (fieldId) => form.querySelector(`[data-field-error-for="${escapeSelector(fieldId)}"]`);

  const setFieldError = (field, message) => {
    const errorNode = getErrorNode(field.id);
    if (errorNode instanceof HTMLElement) {
      errorNode.textContent = message;
    }

    if (message) {
      field.setAttribute('aria-invalid', 'true');
    } else {
      field.removeAttribute('aria-invalid');
    }
  };

  const validateField = (field) => {
    const value = field instanceof HTMLInputElement && field.type === 'checkbox' ? field.checked : field.value.trim();

    let errorMessage = '';

    if (field instanceof HTMLInputElement && field.type === 'checkbox') {
      if (field.required && !value) {
        errorMessage = 'Please confirm the request before submitting.';
      }
    } else {
      if (field.hasAttribute('required') && value === '') {
        errorMessage = 'This field is required.';
      }

      if (!errorMessage && typeof value === 'string' && field.hasAttribute('minlength')) {
        const min = Number.parseInt(field.getAttribute('minlength') || '', 10);
        if (Number.isFinite(min) && value.length < min) {
          errorMessage = `Please enter at least ${min} characters.`;
        }
      }

      if (!errorMessage && typeof value === 'string' && field.hasAttribute('maxlength')) {
        const max = Number.parseInt(field.getAttribute('maxlength') || '', 10);
        if (Number.isFinite(max) && value.length > max) {
          errorMessage = `Please keep this field under ${max} characters.`;
        }
      }

      if (!errorMessage && field instanceof HTMLInputElement && field.type === 'email' && value !== '') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          errorMessage = 'Please enter a valid email address.';
        }
      }

      if (!errorMessage && field instanceof HTMLInputElement && field.name === 'phone' && value !== '') {
        const numericLength = value.replace(/\D/g, '').length;
        if (numericLength < 7) {
          errorMessage = 'Please enter a valid phone number or leave this field empty.';
        }
      }
    }

    setFieldError(field, errorMessage);
    return errorMessage;
  };

  const updateCharCounter = (entry) => {
    const length = entry.field.value.length;
    entry.counter.textContent = `${length}/${entry.max}`;
    entry.counter.classList.toggle('is-near-limit', length >= Math.floor(entry.max * 0.85) && length < entry.max);
    entry.counter.classList.toggle('is-at-limit', length >= entry.max);
  };

  const clearErrorSummary = () => {
    if (errorSummary instanceof HTMLElement) {
      errorSummary.hidden = true;
    }

    if (errorList instanceof HTMLElement) {
      errorList.innerHTML = '';
    }
  };

  const showErrorSummary = (issues) => {
    if (!(errorSummary instanceof HTMLElement) || !(errorList instanceof HTMLElement)) {
      return;
    }

    errorList.innerHTML = '';

    issues.forEach((issue) => {
      const listItem = document.createElement('li');
      if (issue.fieldId) {
        const link = document.createElement('a');
        link.href = `#${issue.fieldId}`;
        link.textContent = issue.message;
        link.addEventListener('click', (event) => {
          event.preventDefault();
          const target = form.querySelector(`#${escapeSelector(issue.fieldId)}`);
          if (target instanceof HTMLElement) {
            target.focus();
          }
        });
        listItem.append(link);
      } else {
        listItem.textContent = issue.message;
      }

      errorList.append(listItem);
    });

    errorSummary.hidden = false;
    errorSummary.focus();
  };

  const validateForm = () => {
    const issues = [];

    if (honeypot instanceof HTMLInputElement && honeypot.value.trim() !== '') {
      issues.push({ fieldId: '', message: 'Unable to submit this request.' });
      return issues;
    }

    if (getElapsedSeconds() < MIN_SUBMIT_SECONDS) {
      issues.push({ fieldId: '', message: 'Please wait a few seconds before submitting the form.' });
      return issues;
    }

    validatableFields.forEach((field) => {
      const message = validateField(field);
      if (!message) {
        return;
      }

      issues.push({
        fieldId: field.id,
        message,
      });
    });

    return issues;
  };

  validatableFields.forEach((field) => {
    field.addEventListener('blur', () => {
      validateField(field);
    });

    field.addEventListener('input', () => {
      if (field.getAttribute('aria-invalid') === 'true') {
        validateField(field);
      }

      const counterEntry = charCounters.find((entry) => entry.field === field);
      if (counterEntry) {
        updateCharCounter(counterEntry);
      }

      clearErrorSummary();
      setStatus('');
      hideSuccess();
    });
  });

  charCounters.forEach((entry) => {
    updateCharCounter(entry);
  });

  form.addEventListener('submit', async (event) => {
    hideSuccess();
    clearErrorSummary();

    if (!supportsAsyncSubmit) {
      return;
    }

    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const issues = validateForm();
    if (issues.length > 0) {
      showErrorSummary(issues);
      setStatus('Please review the highlighted fields and submit again.', 'is-error');
      return;
    }

    setSubmittingState(true);
    setStatus('Submitting your request...', 'is-info');

    const currentReferenceId = referenceIdInput instanceof HTMLInputElement ? referenceIdInput.value : '';

    try {
      const formData = new FormData(form);
      if (currentReferenceId !== '') {
        formData.set('reference_id', currentReferenceId);
      }

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        credentials: 'omit',
        body: formData,
        headers: {
          Accept: 'application/json',
        },
      });

      let payload = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      if (!response.ok || !payload || payload.ok !== true) {
        const message = payload && typeof payload.error === 'string' ? payload.error : 'Unable to submit right now. Please try again later.';
        throw new Error(message);
      }

      const responseReferenceId = payload && typeof payload.referenceId === 'string' && payload.referenceId ? payload.referenceId : currentReferenceId;

      form.reset();
      validatableFields.forEach((field) => setFieldError(field, ''));
      charCounters.forEach((entry) => updateCharCounter(entry));
      stampSubmitTime();
      issueReferenceId();

      if (responseReferenceId) {
        showSuccess(responseReferenceId);
        saveSuccess(responseReferenceId);
      }

      clearErrorSummary();
      setStatus('Request submitted successfully. Check your email for verification steps.', 'is-success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to submit right now. Please try again later.';
      showErrorSummary([{ fieldId: '', message }]);
      setStatus(message, 'is-error');
    } finally {
      setSubmittingState(false);
    }
  });

  stampSubmitTime();
  issueReferenceId();
  restoreSuccess();
}

function createReferenceId() {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `DR-${year}${month}${day}-${random}`;
}
