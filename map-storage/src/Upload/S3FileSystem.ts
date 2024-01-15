import { IncomingMessage } from "http";
import { Readable } from "stream";
import path from "path";
import {
    CopyObjectCommand,
    DeleteObjectCommand,
    DeleteObjectsCommand,
    GetObjectCommand,
    HeadObjectCommand,
    ListObjectsCommand,
    ListObjectsCommandInput,
    ListObjectsCommandOutput,
    ListObjectsV2Command,
    NoSuchKey,
    PutObjectCommand,
    S3,
} from "@aws-sdk/client-s3";
import mime from "mime";
import { NextFunction, Response } from "express";
import { Archiver } from "archiver";
import { StreamZipAsync, ZipEntry } from "node-stream-zip";
import pLimit from "p-limit";
import { s3UploadConcurrencyLimit } from "../Services/S3Client";
import { MapListService } from "../Services/MapListService";
import { FileNotFoundError } from "./FileNotFoundError";
import { FileSystemInterface } from "./FileSystemInterface";

/* eslint-disable no-await-in-loop */

export class S3FileSystem implements FileSystemInterface {
    public constructor(private s3: S3, private bucketName: string) {}

    async deleteFiles(path: string): Promise<void> {
        if (!path.endsWith("/")) {
            // The path might be a single file
            if (await this.isFile(path)) {
                await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucketName, Key: path }));
                return;
            }
        }

        let directory = path;

        if (!directory.endsWith("/")) {
            directory += "/";
        }

        // Delete all files in the S3 bucket
        let listObjectsResponse: ListObjectsCommandOutput;
        let pageMarker: string | undefined;
        do {
            const command: ListObjectsCommandInput = {
                Bucket: this.bucketName,
                MaxKeys: 1000,
                Prefix: directory,
            };
            if (pageMarker) {
                command.Marker = pageMarker;
            }

            listObjectsResponse = await this.s3.send(new ListObjectsCommand(command));
            const objects = listObjectsResponse.Contents;

            if (objects && objects.length > 0) {
                await this.s3.send(
                    new DeleteObjectsCommand({
                        Bucket: this.bucketName,
                        Delete: { Objects: objects.map((o) => ({ Key: o.Key })) },
                    })
                );

                if (listObjectsResponse.IsTruncated) {
                    pageMarker = objects.slice(-1)[0].Key;
                }
            }
        } while (listObjectsResponse.IsTruncated);
    }

    private async isFile(path: string): Promise<boolean> {
        try {
            await this.s3.send(new HeadObjectCommand({ Bucket: this.bucketName, Key: path }));
            return true;
        } catch (e) {
            if (e instanceof NoSuchKey) {
                return false;
            }
            throw e;
        }
    }

    async deleteFilesExceptWAM(directory: string, filesFromZip: string[]): Promise<void> {
        if (!directory.endsWith("/")) {
            directory += "/";
        }

        // Delete all files in the S3 bucket
        let listObjectsResponse: ListObjectsCommandOutput;
        let pageMarker: string | undefined;
        do {
            const command: ListObjectsCommandInput = {
                Bucket: this.bucketName,
                MaxKeys: 1000,
                Prefix: directory,
            };
            if (pageMarker) {
                command.Marker = pageMarker;
            }
            listObjectsResponse = await this.s3.send(new ListObjectsCommand(command));
            const objects = listObjectsResponse.Contents;

            if (objects && objects.length > 0) {
                await this.s3.send(
                    new DeleteObjectsCommand({
                        Bucket: this.bucketName,
                        Delete: {
                            Objects: objects
                                .filter((o) => {
                                    if (o.Key?.includes(".wam")) {
                                        const wamKey = o.Key.slice().replace(directory, "");
                                        const tmjKey = wamKey.slice().replace(".wam", ".tmj");
                                        // do not delete existing .wam file if there's no new version in zip and .tmj file with the same name exists
                                        if (filesFromZip.includes(tmjKey) && !filesFromZip.includes(wamKey)) {
                                            return false;
                                        }
                                    }
                                    return true;
                                })
                                .map((o) => ({ Key: o.Key })),
                        },
                    })
                );

                if (listObjectsResponse.IsTruncated) {
                    pageMarker = objects.slice(-1)[0].Key;
                }
            }
        } while (listObjectsResponse.IsTruncated);
    }

    async exist(virtualPath: string): Promise<boolean> {
        return (await this.listFiles(virtualPath)).length > 0;
    }

    async move(virtualPath: string, newVirtualPath: string): Promise<void> {
        return await this.moveInternal(virtualPath, newVirtualPath, true);
    }

    async copy(virtualPath: string, newVirtualPath: string): Promise<void> {
        return await this.moveInternal(virtualPath, newVirtualPath);
    }

    private async moveInternal(virtualPath: string, newVirtualPath: string, deletePrevious = false) {
        let isTruncated = true;
        let continuationToken: string | undefined = undefined;
        let result;
        while (isTruncated) {
            result = await this.s3.send(
                new ListObjectsV2Command({
                    Bucket: this.bucketName,
                    Prefix: virtualPath,
                    ContinuationToken: continuationToken,
                })
            );

            // Get the list of objects from the result
            const objects = result.Contents;

            const limit = pLimit(30);

            // Use Promise.all to run the copy and delete operations in parallel
            if (objects) {
                const requests = objects.map(async (object) => {
                    const objectKey = object.Key;

                    if (!objectKey) {
                        throw new Error("No key on object : " + JSON.stringify(object));
                    }

                    const targetObjectKey = objectKey.replace(virtualPath, newVirtualPath);
                    await limit(async () => {
                        await this.s3.send(
                            new CopyObjectCommand({
                                Bucket: this.bucketName,
                                CopySource: `${this.bucketName}/${objectKey}`,
                                Key: targetObjectKey,
                            })
                        );
                        if (deletePrevious) {
                            await this.s3.send(
                                new DeleteObjectCommand({
                                    Bucket: this.bucketName,
                                    Key: objectKey,
                                })
                            );
                        }
                    });
                });

                await Promise.all(requests);
            }

            // Check if there are more objects to list
            isTruncated = result.IsTruncated ?? false;
            continuationToken = result.NextContinuationToken;
        }
    }

    async writeFile(zipEntry: ZipEntry, targetFilePath: string, zip: StreamZipAsync): Promise<void> {
        await s3UploadConcurrencyLimit(async () =>
            this.s3.send(
                new PutObjectCommand({
                    Bucket: this.bucketName,
                    Key: targetFilePath,
                    Body: (await zip.stream(zipEntry)) as unknown as ReadableStream,
                    ContentType: mime.getType(targetFilePath) ?? undefined,
                    ContentLength: zipEntry.size,
                })
            )
        );
        return;
    }

    async listFiles(virtualDirectory: string, extension?: string): Promise<string[]> {
        let listObjectsResponse: ListObjectsCommandOutput;
        let pageMarker: string | undefined;
        const allObjects = [];
        do {
            const command: ListObjectsCommandInput = {
                Bucket: this.bucketName,
                MaxKeys: 1000,
                Prefix: virtualDirectory,
            };
            if (pageMarker) {
                command.Marker = pageMarker;
            }
            listObjectsResponse = await this.s3.send(new ListObjectsCommand(command));
            const objects = listObjectsResponse.Contents;
            if (objects) {
                allObjects.push(...objects);
            }
        } while (listObjectsResponse.IsTruncated);

        const recordsPaths: string[] = allObjects.map((record) => record.Key ?? "") ?? [];
        if (extension) {
            return recordsPaths
                .filter((record) => path.extname(record) === extension)
                .map((record) => path.relative(virtualDirectory, record));
        }
        return recordsPaths.map((record) => path.relative(virtualDirectory, record));
    }

    serveStaticFile(virtualPath: string, res: Response, next: NextFunction): void {
        this.s3
            .getObject({ Bucket: this.bucketName, Key: virtualPath })
            .then((result) => {
                // Set the content type and content length headers
                res.set("Content-Type", result.ContentType);

                if (result.ContentLength) {
                    res.set("Content-Length", result.ContentLength.toString());
                }

                if (result.ETag) {
                    res.set("ETag", result.ETag);
                }

                if (result.Expires) {
                    res.set("Expires", result.Expires.toString());
                }

                // TODO assess this idea: REDIRECT TO THE BUCKET PUBLIC URL FOR MOST FILES EXCEPT .html files

                if (!result.Body) {
                    throw new Error("Missing body");
                }

                // Typescript doc is wrong in AWS: see: https://github.com/aws/aws-sdk-js-v3/issues/1877#issuecomment-755387549
                //eslint-disable-next-line @typescript-eslint/ban-ts-comment
                //@ts-ignore
                (result.Body as IncomingMessage).pipe(res);
            })
            .catch((err) => {
                if (err instanceof Error && err.constructor.name === "NoSuchKey") {
                    next();
                } else {
                    next(err);
                }
            });
    }

    async readFileAsString(virtualPath: string): Promise<string> {
        try {
            const file = await this.s3.getObject({ Bucket: this.bucketName, Key: virtualPath });

            if (!file.Body) {
                throw new Error("Missing body");
            }

            return file.Body.transformToString("utf-8");
        } catch (e) {
            if (e instanceof NoSuchKey) {
                throw new FileNotFoundError(e.message, {
                    cause: e,
                });
            }
            throw e;
        }
    }

    async writeStringAsFile(virtualPath: string, content: string): Promise<void> {
        await s3UploadConcurrencyLimit(() =>
            this.s3.send(
                new PutObjectCommand({
                    Bucket: this.bucketName,
                    Key: virtualPath,
                    Body: content,
                    ContentType: mime.getType(virtualPath) ?? undefined,
                })
            )
        );
        return;
    }

    async archiveDirectory(archiver: Archiver, virtualPath: string): Promise<void> {
        if (!virtualPath.endsWith("/")) {
            virtualPath += "/";
        }

        // Zip all files in the S3 bucket
        let listObjectsResponse: ListObjectsCommandOutput;
        let pageMarker: string | undefined;
        do {
            const command: ListObjectsCommandInput = {
                Bucket: this.bucketName,
                MaxKeys: 1000,
                Prefix: virtualPath,
            };
            if (pageMarker) {
                command.Marker = pageMarker;
            }
            listObjectsResponse = await this.s3.send(new ListObjectsCommand(command));
            const objects = listObjectsResponse.Contents;

            if (objects) {
                for (const file of objects) {
                    const { Body } = await this.s3.send(
                        new GetObjectCommand({
                            Bucket: this.bucketName,
                            Key: file.Key,
                        })
                    );
                    if (!file.Key || !Body) {
                        throw new Error("Failed to get file from S3");
                    }
                    if (file.Key.endsWith("/")) {
                        // a directory. Let's bypass this.
                        continue;
                    }
                    if (file.Key.includes(MapListService.CACHE_NAME)) {
                        // we do not want cache file to be downloaded
                        continue;
                    }
                    archiver.append(Body as Readable, { name: file.Key.substring(virtualPath.length) });
                }
                if (listObjectsResponse.IsTruncated) {
                    pageMarker = objects.slice(-1)[0].Key;
                }
            }
        } while (listObjectsResponse.IsTruncated);
    }
}
