RODRIGUES GROUP CONSTRUCTION — V3 COM SUPABASE

O QUE MUDOU
- O site público carrega os imóveis diretamente do banco Supabase.
- O painel secreto continua em owner.html e não aparece no menu público.
- O login agora usa Supabase Auth (e-mail + senha real).
- Apenas usuários cadastrados na tabela owner_profiles têm acesso administrativo.
- Casas, status e vendas ficam salvos no PostgreSQL do Supabase.
- Fotos são enviadas para o Supabase Storage.
- Vendas geram número de comprovante no banco e podem ser reimpressas em qualquer dispositivo.
- Ao registrar uma venda, o imóvel pode ser marcado como vendido automaticamente na mesma transação.
- RLS protege imóveis administrativos, vendas e uploads mesmo se alguém descobrir a rota owner.html.

ARQUIVOS IMPORTANTES
- index.html ................ site público
- owner.html ................ painel secreto dos proprietários
- supabase-config.js ........ Project URL + chave pública do Supabase
- db.js ..................... integração JavaScript com Supabase
- supabase-schema.sql ....... cria tabelas, RLS, Storage e função de venda
- create-first-owner.sql .... libera o primeiro usuário como owner/admin
- supabase-demo-data.sql .... opcional; adiciona 3 casas fictícias para teste

CONFIGURAÇÃO — PASSO A PASSO
1. Crie ou abra um projeto no Supabase.
2. Abra SQL Editor e execute todo o arquivo supabase-schema.sql.
3. Vá em Authentication > Users e crie o e-mail/senha do proprietário.
4. Copie o UUID do usuário criado.
5. Abra create-first-owner.sql, troque COLE_AQUI_O_UUID_DO_USUARIO pelo UUID e execute o INSERT.
6. No Supabase, copie a Project URL e a chave pública Publishable/anon.
7. Abra supabase-config.js e cole os dois valores.
8. Publique todos os arquivos juntos no GitHub Pages, Cloudflare Pages ou outra hospedagem estática.
9. O site público fica em /index.html e o painel fica em /owner.html.

IMPORTANTE SOBRE SEGURANÇA
- A chave Publishable/anon pode ficar no front-end. A proteção real é feita pelas políticas RLS.
- NUNCA coloque a chave service_role no site, no GitHub ou no navegador.
- Não existe mais senha padrão gravada no código.
- A conta de owner deve ser criada no Supabase Auth.
- Saber o endereço /owner.html NÃO dá acesso ao banco sem autenticação e permissão de owner.

COMPROVANTES
Os comprovantes gerados pelo painel são registros internos da negociação. Eles podem ser impressos ou salvos em PDF pelo navegador, mas não substituem contrato, escritura, nota fiscal, recibo fiscal, registro imobiliário ou documentos exigidos por lei.
