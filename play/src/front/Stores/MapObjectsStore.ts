import { EntityPrefab, Direction } from "@workadventure/map-editor";
import type { Readable, Subscriber, Unsubscriber, Writable } from "svelte/store";
import { get, readable, writable } from "svelte/store";
import furnitureCollection from "../Components/entityCollection/FurnitureCollection.json"
import officeCollection from "../Components/entityCollection/OfficeCollection.json"


export interface EntityCollection
{
    collectionName: string;
    collection:EntityPrefab[];
}


export class MapEntitiesStore implements Readable<EntityPrefab[]>
{
    private allDirection =[Direction.Left, Direction.Up, Direction.Down, Direction.Right]
    private mapEntitiesStore = writable<EntityPrefab[]>([]);

    private mapObjects: EntityPrefab[]=[];
    private filter:string = "";
    public tagsStore= writable<string[]>([]);
    private currentCollection:EntityCollection = {collectionName:"All Object Collection", collection:[]};

    constructor()
    {
        let allCollections = [furnitureCollection, officeCollection];
        const folder = "/src/front/Components/images/objects/";
        let tagSet = new Set<string>();
        allCollections.forEach(collection => {
            collection.collection.forEach((entity:EntityPrefab) => {
                this.currentCollection.collection.push({
                    name : entity.name,
                    tags : [...entity.tags, ...collection.tags],
                    imagePath : folder + entity.imagePath,
                    direction : Direction[<keyof typeof Direction>entity.direction],
                    color : entity.color,
                    collisionGrid : entity.collisionGrid
                });
                entity.tags.forEach((tag:string) => tagSet.add(tag));
            });
        });

        let tags = [...tagSet]
        tags.sort();
        this.tagsStore.set(tags);
        this.mapEntitiesStore.set(this.currentCollection.collection);
    }

    subscribe(run: Subscriber<EntityPrefab[]>, invalidate?: ((value?: EntityPrefab[] | undefined) => void) | undefined): Unsubscriber {
        return this.mapEntitiesStore.subscribe(run, invalidate);
    }

    public getObjects()
    {
        return get(this.mapEntitiesStore);
    }

    public setNameFilter(filter: string)
    {
        this.filter = filter;
        this.applyFilters();
    }

    private applyFilters()
    {
        let filters = this.filter.toLowerCase().split(" ").filter(v=> v.trim()!=="");
        let newCollection = this.currentCollection.collection;
        newCollection = newCollection.filter(item => filters.every(word => item.name.toLowerCase().includes(word)) || filters.every(word => item.tags.includes(word)));
        this.mapEntitiesStore.set(newCollection);
    }
}