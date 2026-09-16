-- OPCIONAL: dados fictícios apenas para testar o catálogo.
-- Não rode em produção se não quiser imóveis de demonstração.

insert into public.properties (title, category, price, area, suites, garages, location, description, features, status)
values
('Residência Horizon', 'Alto padrão', 2890000, 420, 4, 3, 'Portfólio Rodrigues Group', 'Arquitetura contemporânea, integração total das áreas sociais e acabamento premium.', array['4 suítes','3 vagas','Piscina'], 'available'),
('Casa Aurum', 'Premium', 1780000, 280, 3, 2, 'Portfólio Rodrigues Group', 'Projeto sofisticado com ambientes amplos, jardim e área gourmet.', array['3 suítes','2 vagas','Gourmet'], 'available'),
('Villa Solaris', 'Exclusivo', 4950000, 610, 5, 4, 'Portfólio Rodrigues Group', 'Residência de luxo com pé-direito duplo, lazer completo e espaços integrados.', array['5 suítes','4 vagas','Home cinema'], 'available');
