-- "Aceite qualquer formato; nós convertemos."
--
-- A restrição de mime no bucket devolvia o problema para a cliente: se o
-- navegador dela não conseguia converter a foto, o storage recusava e ela
-- ficava sem saber o que fazer. Agora o bucket aceita o que vier e o servidor
-- normaliza para JPEG (lib/imagem-servidor), apagando o original em seguida —
-- ninguém precisa dele, e a análise do cabelo não lê HEIC.
--
-- O teto de tamanho continua: 25 MB é generoso para foto de celular e ainda
-- protege contra upload acidental de vídeo.
update storage.buckets
   set allowed_mime_types = null,
       file_size_limit = 26214400  -- 25 MB
 where id = 'hair-photos';
