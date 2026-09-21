-- Foto que a cliente não consegue enviar é venda que não se completa.
--
-- O bucket aceitava só JPEG/PNG/WebP com teto de 10 MB. A foto do iPhone é
-- HEIC e passa dos 10 MB com facilidade: quando a conversão no navegador
-- falhava (acontece com HEIC em vários navegadores), o upload era recusado
-- aqui e a cliente via "verifique a conexão" — que nunca foi o problema.
--
-- O caminho normal continua sendo converter para JPEG no navegador
-- (lib/foto-upload). Isto aqui é a rede de segurança para quando a conversão
-- não for possível: melhor receber um HEIC grande e tratar depois do que
-- perder a foto da cliente.
update storage.buckets
   set allowed_mime_types = array[
         'image/jpeg', 'image/png', 'image/webp',
         'image/heic', 'image/heif', 'image/jpg'
       ],
       file_size_limit = 26214400  -- 25 MB
 where id = 'hair-photos';
