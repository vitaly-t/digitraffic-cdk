import * as pgPromise from "pg-promise";
import {dbTestBase, insertDisruption} from "../db-testutil";
import {newDisruption, someNumber} from "../testdata";
import {DbDisruption, deleteAllButDisruptions, findAll, updateDisruptions} from "../../../lib/db/db-disruptions";
import {Geometry} from "wkx";
import {Geometry as GeoJSONGeometry} from "geojson";

describe('db-disruptions', dbTestBase((db: pgPromise.IDatabase<any, any>) => {

    test('findAll', async () => {
        const disruptions = Array.from({length: Math.floor(Math.random() * 10)}).map(() => {
            return newDisruption();
        });
        await insertDisruption(db, disruptions);

        const fetchedDisruptions = await findAll(db);

        expect(fetchedDisruptions.length).toBe(disruptions.length);
    });

    test('updateDisruptions - insert', async () => {
        const disruption = newDisruption();

        await Promise.all(updateDisruptions(db, [disruption]));

        const fetchedDisruptions = await findAll(db);

        expect(fetchedDisruptions.length).toBe(1);
        const fd = fetchedDisruptions[0] as DbDisruption;
        expect(Number(fd.id)).toBe(disruption.Id);
        expect(Number(fd.type_id)).toBe(disruption.Type_Id);
        expect(fd.start_date).toMatchObject(disruption.StartDate);
        expect(fd.end_date).toMatchObject(disruption.EndDate);
        expect(fd.description_fi).toBe(disruption.DescriptionFi);
        expect(fd.description_sv).toBe(disruption.DescriptionSv);
        expect(fd.description_en).toBe(disruption.DescriptionEn);
        expect(Geometry.parse(Buffer.from(fetchedDisruptions[0].geometry, "hex")).toGeoJSON() as GeoJSONGeometry)
            .toMatchObject(disruption.geometry);
    });

    test('updateDisruptions - update', async () => {
        const disruption = newDisruption();
        await insertDisruption(db, [disruption]);
        const updatedDisruption = newDisruption();
        updatedDisruption.Id = disruption.Id;

        await Promise.all(updateDisruptions(db, [updatedDisruption]));

        const fetchedDisruptions = await findAll(db);
        expect(fetchedDisruptions.length).toBe(1);
        const fd = fetchedDisruptions[0] as DbDisruption;
        expect(Number(fd.type_id)).toBe(updatedDisruption.Type_Id);
        expect(fd.start_date).toMatchObject(updatedDisruption.StartDate);
        expect(fd.end_date).toMatchObject(updatedDisruption.EndDate);
        expect(fd.description_fi).toBe(updatedDisruption.DescriptionFi);
        expect(fd.description_sv).toBe(updatedDisruption.DescriptionSv);
        expect(fd.description_en).toBe(updatedDisruption.DescriptionEn);
        expect(Geometry.parse(Buffer.from(fetchedDisruptions[0].geometry, "hex")).toGeoJSON() as GeoJSONGeometry)
            .toMatchObject(updatedDisruption.geometry);
    });

    test("deleteAllButDisruptions - dont delete existing", async () => {
        const disruption = newDisruption();
        await Promise.all(updateDisruptions(db, [disruption]));

        await deleteAllButDisruptions(db, [disruption.Id]);

        const fetchedDisruptions = await findAll(db);
        expect(fetchedDisruptions.length).toBe(1);
    });

    test("deleteAllButDisruptions - delete nonexisting", async () => {
        const disruption = newDisruption();
        await Promise.all(updateDisruptions(db, [disruption]));

        await deleteAllButDisruptions(db, [someNumber()]);

        const fetchedDisruptions = await findAll(db);
        expect(fetchedDisruptions.length).toBe(0);
    });

    test("deleteAllButDisruptions - delete all", async () => {
        const disruption = newDisruption();
        await Promise.all(updateDisruptions(db, [disruption]));

        await deleteAllButDisruptions(db, []);

        const fetchedDisruptions = await findAll(db);
        expect(fetchedDisruptions.length).toBe(0);
    });

}));
