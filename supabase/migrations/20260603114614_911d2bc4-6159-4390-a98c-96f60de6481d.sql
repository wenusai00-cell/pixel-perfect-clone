
CREATE POLICY "Users manage own pdfs - select"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'employee-pdfs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users manage own pdfs - insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'employee-pdfs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users manage own pdfs - update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'employee-pdfs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users manage own pdfs - delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'employee-pdfs' AND auth.uid()::text = (storage.foldername(name))[1]);
