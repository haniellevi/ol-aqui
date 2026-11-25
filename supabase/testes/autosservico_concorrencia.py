"""Corridas legítimas em conexões locais do banco descartável, sem serviços externos."""
from concurrent.futures import ThreadPoolExecutor
import re


def verificar_autosservico(sql, checked):
    checked(sql("""insert into perfis(id,microrregiao_id,nome,cidade,whatsapp,whatsapp_verificado_em)
      select 'user_autoConc901',id,'Pessoa Concorrente','Corrente','5589999990901',now()
      from microrregioes where slug='corrente-pi';
      insert into loja_ia_convites(usuario_id) values('user_autoConc901');
      insert into loja_ia_rascunhos(dono_id,estado) values('user_autoConc901','pronto');"""))
    result = sql("select id from loja_ia_rascunhos where dono_id='user_autoConc901';")
    checked(result)
    draft = re.search(r'[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}', result.stdout).group(0)

    def run(action):
        return sql(f"""begin; set local role authenticated;
          set local request.jwt.claim.role='authenticated';
          set local request.jwt.claim.sub='user_autoConc901';
          {action}; select pg_sleep(0.1); commit;""")

    actions = [f"select loja_ia_descartar('{draft}',0)",
               f"""select loja_ia_publicar('{draft}',0,
               '{{"nome":"Loja Concorrente Sintética","cidade":"Corrente","slug":"auto-conc901","whatsapp":"5589999990901"}}','{{}}')"""]
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(run, actions))
    assert sum(result.returncode == 0 for result in results) == 1, [(r.stdout, r.stderr) for r in results]
    checked(sql("""do $$ begin
      assert (not exists(select 1 from loja_ia_rascunhos where dono_id='user_autoConc901')
        and not exists(select 1 from vitrines_lojas where dono_id='user_autoConc901'))
       or (exists(select 1 from loja_ia_rascunhos where dono_id='user_autoConc901' and estado='publicado' and vitrine_id is not null)
        and exists(select 1 from vitrines_lojas where dono_id='user_autoConc901' and status='ativa')),
        'publicação e descarte devem produzir um único estado consistente';
    end $$;"""))
