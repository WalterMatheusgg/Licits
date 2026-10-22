# Extração documental local

A tela **Contratos → Importar Documento** extrai conteúdo no navegador, sem enviar o documento a uma API paga:

- PDF textual: PDF.js;
- PDF digitalizado e imagens JPG/PNG: Tesseract.js com idioma português;
- regras locais identificam número, objeto, fornecedor/CNPJ, valor, vigência, trechos de cláusulas e linhas de itens reconhecíveis.

O arquivo é armazenado no bucket privado da organização e vinculado ao contrato criado. O usuário revisa os campos antes de salvar. A extração por regras pode deixar dados de fora ou associá-los incorretamente; confirme tudo no documento original. Não é interpretação jurídica.

O OCR baixa os dados do idioma português quando executado pela primeira vez e pode levar algum tempo, dependendo do dispositivo. O fluxo aceita arquivos de até 15 MB e PDFs de até 30 páginas. A função Edge `extract-document` foi mantida temporariamente como resposta de migração (HTTP 410) e não chama mais provedor externo.

O assistente de perguntas sobre contratos é uma função separada e pode usar OpenAI; isso não é necessário para a extração documental.
