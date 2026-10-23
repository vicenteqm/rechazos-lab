"""Regression tests: month replacement, exact attribution and ambiguity preservation."""
import csv, json, os, tempfile, unittest
from pathlib import Path
from unittest.mock import patch
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'automation'))
from update import discover, period, enrich
import update

class FolderTests(unittest.TestCase):
    def test_periods(self):
        for name,expected in [('2026/BPI_NOVIEMBRE.xlsx','2026-11'),('2026/ASISTENCIA_INVEX_10.xlsx','2026-10'),('ASISTENCIA_INVEX_21_10_2026.xlsx','2026-10'),('records_report_20260901_20260930.csv','2026-09'),('RECORDS_2026-12.csv','2026-12')]:
            self.assertEqual(period(Path(name)),expected)
    def test_replaces_one_snapshot_per_month(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);folders={}
            for role in ('stores','attendance','bpi','agency','records'):
                folder=root/role;folder.mkdir();folders[role]=str(folder)
                (folder/('actual.xlsx' if role in ('stores','agency') else 'BPI_SEPTIEMBRE_2026.xlsx')).touch()
            old=root/'bpi/BPI_OCTUBRE_2026.xlsx';new=root/'bpi/BPI_OCTUBRE_2026_NUEVO.xlsx'
            old.touch();new.touch();os.utime(old,(1,1));os.utime(new,(2,2))
            result=discover({'folders':folders});self.assertEqual(len(result['bpi']),2);self.assertIn(new,result['bpi']);self.assertNotIn(old,result['bpi'])
            (root/'stores/copia.xlsx').touch()
            with self.assertRaisesRegex(ValueError,'único'): discover({'folders':folders})
    def test_exact_identity_and_no_client_names(self):
        store={'det':'10','store':'WM UNO','region':'1',**{k:'RESPONSABLE' for k in ('teamLeader','swatLeader','subleader','rh','cpro','bankLink')}}
        employee={'name':'PERSONA REAL','det':'10','role':'PROMOTOR DE CREDITO','id':'123','user':'USUARIO','alias':'ALIAS','start':'2026-09-01','end':'','status':'ACTIVO','days':{'5':'A'}}
        rows=[{'folio':str(i),'month':'2026-09','created':'2026-09-05','region':'ANTERIOR','store':'TIENDA BPI','det':det} for i,det in [(1,'10'),(2,'20'),(3,'10')]]
        bpi={'rows':[{'folio':str(i),'employeeId':'*123' if i!=3 else '*999','employeeUser':'USUARIO' if i!=3 else 'OTRA','employeeAlias':'','employeeExecutive':'ALIAS' if i!=3 else 'SIN USUARIO'} for i in (1,2,3)]}
        result=enrich({'rows':rows},{'rows':[store]},[{'name':'asistencia','period':'2026-09','rows':[employee]}],[bpi])
        self.assertEqual(result['rows'][0]['promoter'],'PERSONA REAL');self.assertEqual(result['rows'][0]['attendanceCode'],'A')
        self.assertEqual(result['rows'][1]['attendanceMatch'],'Sin coincidencia exacta');self.assertEqual(result['rows'][2]['attendanceMatch'],'Sin coincidencia exacta')
        self.assertEqual(len(result['rows']),3)
        conflicting={**employee,'name':'OTRA PERSONA','user':'OTRO','alias':'OTRO'}
        result=enrich({'rows':[dict(rows[0])]},{'rows':[store]},[{'name':'asistencia','period':'2026-09','rows':[employee,conflicting]}],[bpi])
        # Independent user and alias disambiguate an identifier shared by two rows.
        self.assertEqual(result['rows'][0]['promoter'],'PERSONA REAL')
        conflicting={**employee,'name':'OTRA PERSONA'}
        result=enrich({'rows':[dict(rows[0])]},{'rows':[store]},[{'name':'asistencia','period':'2026-09','rows':[employee,conflicting]}],[bpi])
        self.assertEqual(result['rows'][0]['attendanceMatch'],'Identidad ambigua')
class RefreshTests(unittest.TestCase):
    def test_month_replacement_and_failed_refresh_preserves_version(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);folders={}
            for role in ('stores','attendance','bpi','agency','records'):
                folder=root/role;folder.mkdir();folders[role]=str(folder)
            def csvfile(role,name,head,rows):
                path=root/role/name
                with path.open('w',newline='',encoding='utf-8') as file:
                    writer=csv.writer(file);writer.writerow(head);writer.writerows(rows)
                return path
            csvfile('stores','base.csv',['IGNORADO'],[[1]])
            csvfile('attendance','ASISTENCIA_INVEX_09_2026.csv',['IGNORADO'],[[1]])
            h=['FOLIO','FECHA DE CREACION','REGION','DETERMINANTE','ESTATUS BANCO']
            csvfile('bpi','BPI_SEPTIEMBRE_2026.csv',h,[['1','2026-09-01','1','10','RECHAZO']])
            octfile=csvfile('bpi','BPI_OCTUBRE_2026.csv',h,[['2','2026-10-01','1','10','RECHAZO']])
            for month,folio in [('SEPTIEMBRE','1'),('OCTUBRE','2')]: csvfile('records','RECORDS_'+month+'_2026.csv',['FOLIO','ESTATUS FICO'],[[folio,'Declinado']])
            agency=csvfile('agency','consolidado.csv',['FOLIO','ESTATUS_P'],[['1','Sin TDC'],['2','Sin TDC']])
            store={'det':'10','store':'WM UNO','region':'1',**{k:'RESPONSABLE' for k in ('teamLeader','swatLeader','subleader','rh','cpro','bankLink')}}
            config={'folders':folders,'output':str(root/'sitio')}
            with patch.object(update,'PRIVATE',root/'private'),patch.object(update,'read_stores',return_value={'role':'stores','name':'base.csv','sheet':'BASE','rows':[store]}),patch.object(update,'read_attendance',return_value={'role':'attendance','name':'asistencia','sheet':'HOJA','period':'2026-09','rows':[]}):
                first=update.build(config)
                csvfile('bpi',octfile.name,h,[['2','2026-10-01','1','10','COMPLETO'],['3','2026-10-02','1','10','RECHAZO']])
                second=update.build(config);self.assertNotEqual(first['id'],second['id'])
                file=root/'sitio/data'/second['model'];model=json.loads(file.read_text(encoding='utf-8'))
                self.assertEqual(len(model['rows']),3);self.assertEqual(model['automation']['months']['2026-09']['base'],1);self.assertEqual(model['automation']['months']['2026-10']['cases'],1)
                self.assertFalse(update.build(config)['changed'])
                pointer=(root/'sitio/data/version.json').read_bytes()
                csvfile('agency',agency.name,['COLUMNA INCORRECTA'],[['error']])
                with self.assertRaises(ValueError): update.build(config)
                self.assertEqual((root/'sitio/data/version.json').read_bytes(),pointer)

if __name__=='__main__': unittest.main()
