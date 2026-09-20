(function () {
    'use strict';

    function numberError(root) {
        const inputs = [...root.querySelectorAll('input[type="number"]')];
        for (const input of inputs) {
            input.removeAttribute('aria-invalid');
        }
        const invalid = inputs.find((input) => !input.disabled
            && input.getClientRects().length > 0
            && (!input.validity.valid || (input.value !== '' && !Number.isFinite(Number(input.value)))));
        if (!invalid) return '';
        invalid.setAttribute('aria-invalid', 'true');
        const label = invalid.labels?.[0]?.textContent.trim() || invalid.getAttribute('aria-label') || '数值';
        return `${label}填写无效：${invalid.validationMessage || '请输入有效数字'} 请修正后再生成和复制。`;
    }

    window.InputValidation = { numberError };
}());
